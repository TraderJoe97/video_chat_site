using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Backend.Models;

namespace Backend.Services;

public class SupabaseService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<SupabaseService> _logger;
    private readonly string? _supabaseUrl;
    private readonly string? _supabaseKey;
    private readonly bool _isConfigured;
    private bool _isWhiteboardTableAvailable = true;
    private DateTime _lastWhiteboardCheck = DateTime.MinValue;

    public SupabaseService(IConfiguration configuration, ILogger<SupabaseService> logger)
    {
        _logger = logger;
        _supabaseUrl = configuration["SUPABASE_URL"] ?? Environment.GetEnvironmentVariable("SUPABASE_URL");
        _supabaseKey = configuration["SUPABASE_SECRET_KEY"]
            ?? configuration["SUPABASE_KEY"]
            ?? configuration["SUPABASE_PUBLISHABLE_KEY"]
            ?? configuration["SUPABASE_ANON_KEY"]
            ?? Environment.GetEnvironmentVariable("SUPABASE_SECRET_KEY")
            ?? Environment.GetEnvironmentVariable("SUPABASE_KEY")
            ?? Environment.GetEnvironmentVariable("SUPABASE_PUBLISHABLE_KEY")
            ?? Environment.GetEnvironmentVariable("SUPABASE_ANON_KEY");

        _isConfigured = !string.IsNullOrWhiteSpace(_supabaseUrl) && !string.IsNullOrWhiteSpace(_supabaseKey);

        _httpClient = new HttpClient();
        if (_isConfigured)
        {
            _httpClient.BaseAddress = new Uri(_supabaseUrl!.TrimEnd('/') + "/rest/v1/");
            _httpClient.DefaultRequestHeaders.Add("apikey", _supabaseKey);
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _supabaseKey);
            _httpClient.DefaultRequestHeaders.Add("Prefer", "return=representation");
            _logger.LogInformation("Supabase persistence successfully configured at {Url}", _supabaseUrl);
        }
        else
        {
            _logger.LogInformation("Supabase environment variables not set; running with in-memory persistence fallback.");
        }
    }

    public bool IsConfigured => _isConfigured;

    public async Task<Meeting?> SaveMeetingAsync(Meeting meeting)
    {
        if (!_isConfigured) return meeting;

        try
        {
            var payload = new
            {
                meeting_id = meeting.MeetingId,
                host_id = meeting.HostId,
                meeting_name = meeting.MeetingName,
                created_at = meeting.CreatedAt
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("meetings?on_conflict=meeting_id", content);
            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Supabase failed to save meeting {MeetingId}: {Error}", meeting.MeetingId, err);
            }
            return meeting;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception saving meeting to Supabase");
            return meeting;
        }
    }

    public async Task<List<Meeting>> FetchMeetingsAsync()
    {
        if (!_isConfigured) return new List<Meeting>();

        try
        {
            var response = await _httpClient.GetAsync("meetings?select=*&order=created_at.desc");
            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                var list = new List<Meeting>();
                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    list.Add(new Meeting
                    {
                        MeetingId = el.GetProperty("meeting_id").GetString() ?? "",
                        HostId = el.GetProperty("host_id").GetString() ?? "",
                        MeetingName = el.TryGetProperty("meeting_name", out var mn) ? (mn.GetString() ?? "") : "Untitled Meeting",
                        CreatedAt = el.TryGetProperty("created_at", out var ca) && ca.TryGetDateTime(out var dt) ? dt : DateTime.UtcNow
                    });
                }
                return list;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception fetching meetings from Supabase");
        }

        return new List<Meeting>();
    }

    public async Task SaveChatMessageAsync(ChatMessage message)
    {
        if (!_isConfigured) return;

        try
        {
            var payload = new
            {
                meeting_id = message.MeetingId,
                sender_id = message.SenderId,
                sender_name = message.SenderName,
                content = message.Content,
                created_at = message.Timestamp
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("chat_messages", content);
            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Supabase failed to save chat message: {Error}", err);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception saving chat message to Supabase");
        }
    }

    public async Task<List<ChatMessage>> FetchChatMessagesAsync(string meetingId)
    {
        if (!_isConfigured) return new List<ChatMessage>();

        try
        {
            var response = await _httpClient.GetAsync($"chat_messages?meeting_id=eq.{Uri.EscapeDataString(meetingId)}&order=created_at.asc");
            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                var list = new List<ChatMessage>();
                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    list.Add(new ChatMessage
                    {
                        Id = el.TryGetProperty("id", out var idProp) ? (idProp.GetString() ?? Guid.NewGuid().ToString()) : Guid.NewGuid().ToString(),
                        MeetingId = el.GetProperty("meeting_id").GetString() ?? meetingId,
                        SenderId = el.GetProperty("sender_id").GetString() ?? "",
                        SenderName = el.GetProperty("sender_name").GetString() ?? "",
                        Content = el.GetProperty("content").GetString() ?? "",
                        Timestamp = el.TryGetProperty("created_at", out var ca) && ca.TryGetDateTime(out var dt) ? dt : DateTime.UtcNow
                    });
                }
                return list;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception fetching chat messages from Supabase for meeting {MeetingId}", meetingId);
        }

        return new List<ChatMessage>();
    }

    // =========================================================================
    // Whiteboard Persistence (PostgreSQL JSONB Storage)
    // =========================================================================
    public async Task SaveWhiteboardStateAsync(string meetingId, object sceneData)
    {
        if (!_isConfigured) return;

        // If table was missing, retry only every 60 seconds to avoid flooding logs
        if (!_isWhiteboardTableAvailable && DateTime.UtcNow - _lastWhiteboardCheck < TimeSpan.FromSeconds(60))
        {
            return;
        }

        try
        {
            _lastWhiteboardCheck = DateTime.UtcNow;

            var payload = new
            {
                meeting_id = meetingId,
                scene_data = sceneData,
                updated_at = DateTime.UtcNow
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("meeting_whiteboards?on_conflict=meeting_id", content);
            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync();
                if (err.Contains("PGRST205") || err.Contains("schema cache") || err.Contains("relation") || err.Contains("does not exist"))
                {
                    if (_isWhiteboardTableAvailable)
                    {
                        _isWhiteboardTableAvailable = false;
                        _logger.LogWarning("Supabase table 'public.meeting_whiteboards' not yet created. Using in-memory fallback. Run schema.sql in Supabase SQL editor to enable PostgreSQL whiteboard storage.");
                    }
                }
                else
                {
                    _logger.LogWarning("Supabase failed to save whiteboard state for {MeetingId}: {Error}", meetingId, err);
                }
            }
            else
            {
                _isWhiteboardTableAvailable = true;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception saving whiteboard state to Supabase for {MeetingId}", meetingId);
        }
    }

    public async Task<object?> FetchWhiteboardStateAsync(string meetingId)
    {
        if (!_isConfigured || !_isWhiteboardTableAvailable) return null;

        try
        {
            var response = await _httpClient.GetAsync($"meeting_whiteboards?meeting_id=eq.{Uri.EscapeDataString(meetingId)}&select=scene_data");
            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.ValueKind == JsonValueKind.Array && doc.RootElement.GetArrayLength() > 0)
                {
                    var first = doc.RootElement[0];
                    if (first.TryGetProperty("scene_data", out var sceneElement))
                    {
                        return JsonSerializer.Deserialize<object>(sceneElement.GetRawText());
                    }
                }
            }
            else
            {
                var err = await response.Content.ReadAsStringAsync();
                if (err.Contains("PGRST205") || err.Contains("schema cache"))
                {
                    _isWhiteboardTableAvailable = false;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception fetching whiteboard state from Supabase for {MeetingId}", meetingId);
        }

        return null;
    }
}

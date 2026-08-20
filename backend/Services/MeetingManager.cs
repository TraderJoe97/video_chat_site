using System.Collections.Concurrent;
using Backend.Models;

namespace Backend.Services;

public class MeetingManager : IDisposable
{
    private readonly ConcurrentDictionary<string, Meeting> _meetings = new();
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, Participant>> _meetingParticipants = new();
    private readonly ConcurrentDictionary<string, List<ChatMessage>> _meetingMessages = new();
    private readonly ConcurrentDictionary<string, object> _latestWhiteboardScenes = new();
    private readonly ConcurrentDictionary<string, DateTime> _pendingWhiteboardSaves = new();
    private readonly ConcurrentDictionary<string, string> _activeScreenSharers = new(); // meetingId -> userId
    private readonly SupabaseService _supabaseService;
    private readonly ILogger<MeetingManager> _logger;
    private readonly Timer _dbFlushTimer;
    private bool _disposed;

    public MeetingManager(SupabaseService supabaseService, ILogger<MeetingManager> logger)
    {
        _supabaseService = supabaseService;
        _logger = logger;

        // Background debouncer: flushes dirty whiteboard scenes to Supabase every 2 seconds
        _dbFlushTimer = new Timer(async _ => await FlushDirtyWhiteboardsAsync(), null, TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(2));
    }

    public async Task<Meeting> CreateOrGetMeetingAsync(string meetingId, string hostId, string? meetingName = null)
    {
        if (_meetings.TryGetValue(meetingId, out var existing))
        {
            return existing;
        }

        var meeting = new Meeting
        {
            MeetingId = meetingId,
            HostId = hostId,
            MeetingName = string.IsNullOrWhiteSpace(meetingName) ? $"Meeting {meetingId}" : meetingName,
            CreatedAt = DateTime.UtcNow
        };

        _meetings.TryAdd(meetingId, meeting);

        if (_supabaseService.IsConfigured)
        {
            await _supabaseService.SaveMeetingAsync(meeting);
        }

        return meeting;
    }

    public Meeting? GetMeeting(string meetingId)
    {
        return _meetings.TryGetValue(meetingId, out var meeting) ? meeting : null;
    }

    public async Task<IEnumerable<Meeting>> GetAllMeetingsAsync()
    {
        if (_supabaseService.IsConfigured)
        {
            var dbMeetings = await _supabaseService.FetchMeetingsAsync();
            if (dbMeetings.Count > 0)
            {
                foreach (var m in dbMeetings)
                {
                    _meetings.TryAdd(m.MeetingId, m);
                }
            }
        }
        return _meetings.Values;
    }

    public void AddParticipant(string meetingId, Participant participant)
    {
        var participants = _meetingParticipants.GetOrAdd(meetingId, _ => new ConcurrentDictionary<string, Participant>());
        participants.AddOrUpdate(participant.UserId, participant, (_, _) => participant);
    }

    public bool TryStartScreenShare(string meetingId, string userId, out string? currentSharerId)
    {
        currentSharerId = _activeScreenSharers.GetOrAdd(meetingId, userId);
        return currentSharerId == userId;
    }

    public bool StopScreenShare(string meetingId, string userId)
    {
        if (_activeScreenSharers.TryGetValue(meetingId, out var existingSharer) && existingSharer == userId)
        {
            return _activeScreenSharers.TryRemove(meetingId, out _);
        }
        return false;
    }

    public string? GetActiveScreenSharer(string meetingId)
    {
        return _activeScreenSharers.TryGetValue(meetingId, out var sharer) ? sharer : null;
    }

    public void RemoveParticipant(string meetingId, string userId)
    {
        if (_activeScreenSharers.TryGetValue(meetingId, out var sharer) && sharer == userId)
        {
            _activeScreenSharers.TryRemove(meetingId, out _);
        }

        if (_meetingParticipants.TryGetValue(meetingId, out var participants))
        {
            participants.TryRemove(userId, out _);
            if (participants.IsEmpty)
            {
                _meetingParticipants.TryRemove(meetingId, out _);
                _activeScreenSharers.TryRemove(meetingId, out _);
            }
        }
    }

    public void RemoveParticipantByConnectionId(string connectionId, out string? foundMeetingId, out string? foundUserId)
    {
        foundMeetingId = null;
        foundUserId = null;

        foreach (var (meetingId, participants) in _meetingParticipants)
        {
            var match = participants.FirstOrDefault(p => p.Value.ConnectionId == connectionId);
            if (!string.IsNullOrEmpty(match.Key))
            {
                foundMeetingId = meetingId;
                foundUserId = match.Key;
                participants.TryRemove(match.Key, out _);

                if (_activeScreenSharers.TryGetValue(meetingId, out var sharer) && sharer == match.Key)
                {
                    _activeScreenSharers.TryRemove(meetingId, out _);
                }

                if (participants.IsEmpty)
                {
                    _meetingParticipants.TryRemove(meetingId, out _);
                    _activeScreenSharers.TryRemove(meetingId, out _);
                }
                return;
            }
        }
    }

    public IEnumerable<Participant> GetParticipants(string meetingId)
    {
        return _meetingParticipants.TryGetValue(meetingId, out var participants)
            ? participants.Values
            : Enumerable.Empty<Participant>();
    }

    // =========================================================================
    // High-Performance In-Memory Whiteboard Authoritative State & Debounced DB Flush
    // =========================================================================
    public void SetWhiteboardState(string meetingId, object strokeOrScene)
    {
        // 1. Instant zero-latency in-memory state update
        _latestWhiteboardScenes[meetingId] = strokeOrScene;

        // 2. Mark for asynchronous background flush
        _pendingWhiteboardSaves[meetingId] = DateTime.UtcNow;
    }

    public void ClearWhiteboard(string meetingId)
    {
        _latestWhiteboardScenes[meetingId] = new List<object>();
        _pendingWhiteboardSaves[meetingId] = DateTime.UtcNow;
    }

    public async Task<object?> GetWhiteboardStateAsync(string meetingId)
    {
        if (_latestWhiteboardScenes.TryGetValue(meetingId, out var cachedState))
        {
            return cachedState;
        }

        if (_supabaseService.IsConfigured)
        {
            var dbState = await _supabaseService.FetchWhiteboardStateAsync(meetingId);
            if (dbState != null)
            {
                _latestWhiteboardScenes[meetingId] = dbState;
                return dbState;
            }
        }

        return null;
    }

    private async Task FlushDirtyWhiteboardsAsync()
    {
        if (!_supabaseService.IsConfigured || _pendingWhiteboardSaves.IsEmpty) return;

        var keys = _pendingWhiteboardSaves.Keys.ToList();
        foreach (var meetingId in keys)
        {
            if (_pendingWhiteboardSaves.TryRemove(meetingId, out _) &&
                _latestWhiteboardScenes.TryGetValue(meetingId, out var sceneData))
            {
                try
                {
                    await _supabaseService.SaveWhiteboardStateAsync(meetingId, sceneData);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Background error flushing whiteboard state for meeting {MeetingId}", meetingId);
                }
            }
        }
    }

    public async Task AddMessageAsync(string meetingId, ChatMessage message)
    {
        var messages = _meetingMessages.GetOrAdd(meetingId, _ => new List<ChatMessage>());
        lock (messages)
        {
            messages.Add(message);
        }

        if (_supabaseService.IsConfigured)
        {
            await _supabaseService.SaveChatMessageAsync(message);
        }
    }

    public async Task<IEnumerable<ChatMessage>> GetMessagesAsync(string meetingId)
    {
        if (_supabaseService.IsConfigured && !_meetingMessages.ContainsKey(meetingId))
        {
            var dbMessages = await _supabaseService.FetchChatMessagesAsync(meetingId);
            if (dbMessages.Count > 0)
            {
                var messages = _meetingMessages.GetOrAdd(meetingId, _ => new List<ChatMessage>());
                lock (messages)
                {
                    messages.AddRange(dbMessages);
                }
            }
        }

        if (_meetingMessages.TryGetValue(meetingId, out var cachedMessages))
        {
            lock (cachedMessages)
            {
                return cachedMessages.ToList();
            }
        }
        return Enumerable.Empty<ChatMessage>();
    }

    public void Dispose()
    {
        if (!_disposed)
        {
            _disposed = true;
            _dbFlushTimer?.Dispose();
        }
    }
}

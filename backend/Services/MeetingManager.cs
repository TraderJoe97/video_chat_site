using System.Collections.Concurrent;
using Backend.Models;

namespace Backend.Services;

public class MeetingManager
{
    private readonly ConcurrentDictionary<string, Meeting> _meetings = new();
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, Participant>> _meetingParticipants = new();
    private readonly ConcurrentDictionary<string, List<ChatMessage>> _meetingMessages = new();
    private readonly SupabaseService _supabaseService;
    private readonly ILogger<MeetingManager> _logger;

    public MeetingManager(SupabaseService supabaseService, ILogger<MeetingManager> logger)
    {
        _supabaseService = supabaseService;
        _logger = logger;
    }

    public async Task<Meeting> CreateOrGetMeetingAsync(string meetingId, string hostId, string? meetingName)
    {
        var meeting = _meetings.GetOrAdd(meetingId, id => new Meeting
        {
            MeetingId = id,
            HostId = hostId,
            MeetingName = string.IsNullOrWhiteSpace(meetingName) ? $"Meeting {id}" : meetingName,
            CreatedAt = DateTime.UtcNow
        });

        if (_supabaseService.IsConfigured)
        {
            await _supabaseService.SaveMeetingAsync(meeting);
        }

        return meeting;
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
                    _meetings[m.MeetingId] = m;
                }
            }
        }

        return _meetings.Values.OrderByDescending(m => m.CreatedAt);
    }

    public Meeting? GetMeeting(string meetingId) => _meetings.TryGetValue(meetingId, out var m) ? m : null;

    public void AddParticipant(string meetingId, Participant participant)
    {
        var participants = _meetingParticipants.GetOrAdd(meetingId, _ => new ConcurrentDictionary<string, Participant>());
        participants[participant.UserId] = participant;
    }

    public void RemoveParticipant(string meetingId, string userId)
    {
        if (_meetingParticipants.TryGetValue(meetingId, out var participants))
        {
            participants.TryRemove(userId, out _);
            if (participants.IsEmpty)
            {
                _meetingParticipants.TryRemove(meetingId, out _);
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
                if (participants.IsEmpty)
                {
                    _meetingParticipants.TryRemove(meetingId, out _);
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
}

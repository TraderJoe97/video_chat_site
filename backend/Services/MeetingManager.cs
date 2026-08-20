using System.Collections.Concurrent;
using Backend.Models;

namespace Backend.Services;

public class MeetingManager
{
    private readonly ConcurrentDictionary<string, Meeting> _meetings = new();
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, Participant>> _meetingParticipants = new();
    private readonly ConcurrentDictionary<string, List<ChatMessage>> _meetingMessages = new();
    private readonly ConcurrentDictionary<string, List<object>> _whiteboardStrokes = new();
    private readonly ConcurrentDictionary<string, string> _activeScreenSharers = new(); // meetingId -> userId
    private readonly SupabaseService _supabaseService;
    private readonly ILogger<MeetingManager> _logger;

    public MeetingManager(SupabaseService supabaseService, ILogger<MeetingManager> logger)
    {
        _supabaseService = supabaseService;
        _logger = logger;
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
    // Whiteboard Real-Time & PostgreSQL Database Storage
    // =========================================================================
    public async Task AddWhiteboardStrokeAsync(string meetingId, object stroke)
    {
        var strokes = _whiteboardStrokes.GetOrAdd(meetingId, _ => new List<object>());
        lock (strokes)
        {
            strokes.Add(stroke);
            if (strokes.Count > 5000)
            {
                strokes.RemoveRange(0, 1000);
            }
        }

        if (_supabaseService.IsConfigured)
        {
            await _supabaseService.SaveWhiteboardStateAsync(meetingId, stroke);
        }
    }

    public async Task ClearWhiteboardAsync(string meetingId)
    {
        if (_whiteboardStrokes.TryGetValue(meetingId, out var strokes))
        {
            lock (strokes)
            {
                strokes.Clear();
            }
        }

        if (_supabaseService.IsConfigured)
        {
            await _supabaseService.SaveWhiteboardStateAsync(meetingId, new List<object>());
        }
    }

    public async Task<IEnumerable<object>> GetWhiteboardStrokesAsync(string meetingId)
    {
        if (_whiteboardStrokes.TryGetValue(meetingId, out var strokes) && strokes.Count > 0)
        {
            lock (strokes)
            {
                return strokes.ToList();
            }
        }

        if (_supabaseService.IsConfigured)
        {
            var dbState = await _supabaseService.FetchWhiteboardStateAsync(meetingId);
            if (dbState != null)
            {
                var list = _whiteboardStrokes.GetOrAdd(meetingId, _ => new List<object>());
                lock (list)
                {
                    list.Add(dbState);
                }
                return new List<object> { dbState };
            }
        }

        return Enumerable.Empty<object>();
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

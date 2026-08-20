using Microsoft.AspNetCore.SignalR;
using Backend.Models;
using Backend.Services;

namespace Backend.Hubs;

public class MeetingHub : Hub
{
    private readonly MeetingManager _meetingManager;
    private readonly ILogger<MeetingHub> _logger;

    public MeetingHub(MeetingManager meetingManager, ILogger<MeetingHub> logger)
    {
        _meetingManager = meetingManager;
        _logger = logger;
    }

    public async Task JoinMeeting(string meetingId, string userId, string username)
    {
        _logger.LogInformation("User {Username} ({UserId}) joining meeting {MeetingId}", username, userId, meetingId);

        var participant = new Participant
        {
            UserId = userId,
            Username = string.IsNullOrWhiteSpace(username) ? userId : username,
            ConnectionId = Context.ConnectionId,
            JoinedAt = DateTime.UtcNow
        };

        _meetingManager.AddParticipant(meetingId, participant);
        await _meetingManager.CreateOrGetMeetingAsync(meetingId, userId, $"Meeting {meetingId}");

        await Groups.AddToGroupAsync(Context.ConnectionId, meetingId);
        await Groups.AddToGroupAsync(Context.ConnectionId, userId);

        // Notify other participants in the room
        await Clients.OthersInGroup(meetingId).SendAsync("UserJoined", new
        {
            userId = participant.UserId,
            username = participant.Username,
            joinedAt = participant.JoinedAt
        });

        // Send existing participants and messages to the newly joined user
        var existingParticipants = _meetingManager.GetParticipants(meetingId)
            .Where(p => p.UserId != userId)
            .Select(p => new { userId = p.UserId, username = p.Username, isAudioEnabled = p.IsAudioEnabled, isVideoEnabled = p.IsVideoEnabled, isHandRaised = p.IsHandRaised });

        var messagesList = await _meetingManager.GetMessagesAsync(meetingId);
        var messages = messagesList
            .Select(m => new { id = m.Id, senderId = m.SenderId, senderName = m.SenderName, content = m.Content, timestamp = m.Timestamp.ToString("o") });

        var activeScreenSharerId = _meetingManager.GetActiveScreenSharer(meetingId);

        await Clients.Caller.SendAsync("JoinedMeeting", new
        {
            meetingId,
            participants = existingParticipants,
            messages,
            activeScreenSharerId
        });
    }

    public async Task SendMessage(string meetingId, string senderId, string senderName, string content)
    {
        if (string.IsNullOrWhiteSpace(content) || content.Length > 2000) return;

        var message = new ChatMessage
        {
            MeetingId = meetingId,
            SenderId = senderId,
            SenderName = string.IsNullOrWhiteSpace(senderName) ? senderId : senderName,
            Content = content.Trim(),
            Timestamp = DateTime.UtcNow
        };

        await _meetingManager.AddMessageAsync(meetingId, message);

        await Clients.Group(meetingId).SendAsync("ReceiveMessage", new
        {
            id = message.Id,
            senderId = message.SenderId,
            senderName = message.SenderName,
            content = message.Content,
            timestamp = message.Timestamp.ToString("o")
        });
    }

    public async Task RaiseHand(string meetingId, string userId, bool isRaised)
    {
        await Clients.Group(meetingId).SendAsync("UserRaisedHand", new
        {
            userId,
            isRaised
        });
    }

    public async Task ToggleMediaStatus(string meetingId, string userId, bool isAudioEnabled, bool isVideoEnabled)
    {
        await Clients.OthersInGroup(meetingId).SendAsync("UserMediaStatusChanged", new
        {
            userId,
            isAudioEnabled,
            isVideoEnabled
        });
    }

    public async Task<object> StartScreenShare(string meetingId, string userId)
    {
        var success = _meetingManager.TryStartScreenShare(meetingId, userId, out var currentSharerId);
        if (!success)
        {
            var currentSharer = _meetingManager.GetParticipants(meetingId).FirstOrDefault(p => p.UserId == currentSharerId);
            return new { success = false, currentSharerId, currentSharerName = currentSharer?.Username ?? "Another participant" };
        }

        await Clients.Group(meetingId).SendAsync("ScreenShareChanged", userId, true);
        return new { success = true, currentSharerId = userId };
    }

    public async Task StopScreenShare(string meetingId, string userId)
    {
        var stopped = _meetingManager.StopScreenShare(meetingId, userId);
        if (stopped)
        {
            await Clients.Group(meetingId).SendAsync("ScreenShareChanged", (string?)null, false);
        }
    }

    public async Task SendSignal(string targetUserId, string senderUserId, object signalData)
    {
        await Clients.Group(targetUserId).SendAsync("ReceiveSignal", senderUserId, signalData);
    }

    public async Task SendWhiteboardStroke(string meetingId, object strokeData)
    {
        await _meetingManager.AddWhiteboardStrokeAsync(meetingId, strokeData);
        await Clients.OthersInGroup(meetingId).SendAsync("ReceiveWhiteboardStroke", strokeData);
    }

    public async Task ClearWhiteboard(string meetingId)
    {
        await _meetingManager.ClearWhiteboardAsync(meetingId);
        await Clients.Group(meetingId).SendAsync("WhiteboardCleared");
    }

    public async Task ToggleWhiteboardMode(string meetingId, bool isOpen)
    {
        await Clients.Group(meetingId).SendAsync("WhiteboardToggled", isOpen);
    }

    public async Task RequestWhiteboardHistory(string meetingId)
    {
        var history = await _meetingManager.GetWhiteboardStrokesAsync(meetingId);
        await Clients.Caller.SendAsync("ReceiveWhiteboardHistory", history);
    }

    public async Task LeaveMeeting(string meetingId, string userId)
    {
        _logger.LogInformation("User {UserId} leaving meeting {MeetingId}", userId, meetingId);

        var wasSharing = _meetingManager.GetActiveScreenSharer(meetingId) == userId;
        _meetingManager.RemoveParticipant(meetingId, userId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, meetingId);

        await Clients.OthersInGroup(meetingId).SendAsync("UserLeft", userId);
        if (wasSharing)
        {
            await Clients.OthersInGroup(meetingId).SendAsync("ScreenShareChanged", (string?)null, false);
        }
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _meetingManager.RemoveParticipantByConnectionId(Context.ConnectionId, out var meetingId, out var userId);
        if (!string.IsNullOrEmpty(meetingId) && !string.IsNullOrEmpty(userId))
        {
            _logger.LogInformation("Connection {ConnectionId} disconnected, removing user {UserId} from {MeetingId}", Context.ConnectionId, userId, meetingId);
            await Clients.OthersInGroup(meetingId).SendAsync("UserLeft", userId);
            await Clients.OthersInGroup(meetingId).SendAsync("ScreenShareChanged", (string?)null, false);
        }

        await base.OnDisconnectedAsync(exception);
    }
}

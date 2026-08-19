namespace Backend.Models;

public class Meeting
{
    public string MeetingId { get; set; } = string.Empty;
    public string HostId { get; set; } = string.Empty;
    public string MeetingName { get; set; } = "Untitled Meeting";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class CreateMeetingRequest
{
    public string? MeetingId { get; set; }
    public string HostId { get; set; } = string.Empty;
    public string? MeetingName { get; set; }
}

public class Participant
{
    public string UserId { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string ConnectionId { get; set; } = string.Empty;
    public bool IsAudioEnabled { get; set; } = true;
    public bool IsVideoEnabled { get; set; } = true;
    public bool IsHandRaised { get; set; } = false;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}

public class ChatMessage
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string MeetingId { get; set; } = string.Empty;
    public string SenderId { get; set; } = string.Empty;
    public string SenderName { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

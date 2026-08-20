using Microsoft.AspNetCore.Mvc;
using Backend.Models;
using Backend.Services;

namespace Backend.Controllers;

[ApiController]
[Route("api")]
public class MeetingController : ControllerBase
{
    private readonly MeetingManager _meetingManager;
    private readonly SupabaseService _supabaseService;
    private readonly ILogger<MeetingController> _logger;

    public MeetingController(MeetingManager meetingManager, SupabaseService supabaseService, ILogger<MeetingController> logger)
    {
        _meetingManager = meetingManager;
        _supabaseService = supabaseService;
        _logger = logger;
    }

    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new
        {
            status = "ok",
            service = "dotnet-backend",
            version = "net10.0",
            database = _supabaseService.IsConfigured ? "supabase" : "in-memory fallback",
            timestamp = DateTime.UtcNow
        });
    }

    [HttpGet("meetings")]
    [HttpGet("/test-meetings")]
    public async Task<IActionResult> GetMeetings()
    {
        var meetings = await _meetingManager.GetAllMeetingsAsync();
        return Ok(meetings);
    }

    [HttpGet("meetings/{meetingId}")]
    public IActionResult GetMeeting(string meetingId)
    {
        var meeting = _meetingManager.GetMeeting(meetingId);
        if (meeting == null)
        {
            return NotFound(new { error = "Meeting not found" });
        }
        return Ok(meeting);
    }

    [HttpPost("meetings")]
    [HttpPost("/create-meeting")]
    public async Task<IActionResult> CreateMeeting([FromBody] CreateMeetingRequest request)
    {
        var meetingId = string.IsNullOrWhiteSpace(request.MeetingId)
            ? Guid.NewGuid().ToString("N")[..8]
            : request.MeetingId;

        var meeting = await _meetingManager.CreateOrGetMeetingAsync(meetingId, request.HostId, request.MeetingName);
        return CreatedAtAction(nameof(GetMeeting), new { meetingId = meeting.MeetingId }, meeting);
    }

    [HttpGet("meetings/{meetingId}/participants")]
    public IActionResult GetParticipants(string meetingId)
    {
        return Ok(_meetingManager.GetParticipants(meetingId));
    }

    [HttpGet("meetings/{meetingId}/messages")]
    public async Task<IActionResult> GetChatHistory(string meetingId)
    {
        var messages = await _meetingManager.GetMessagesAsync(meetingId);
        return Ok(messages);
    }

    [HttpGet("meetings/{meetingId}/whiteboard")]
    public async Task<IActionResult> GetWhiteboardHistory(string meetingId)
    {
        var history = await _meetingManager.GetWhiteboardStrokesAsync(meetingId);
        return Ok(history);
    }
}

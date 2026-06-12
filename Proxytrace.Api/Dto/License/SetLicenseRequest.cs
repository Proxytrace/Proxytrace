namespace Proxytrace.Api.Dto.License;

/// <summary>
/// Request to set (or validate) the installation's license key.
/// </summary>
public sealed record SetLicenseRequest(string License);

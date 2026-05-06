namespace Trsr.Domain.TestResult;

public record TestResultStatistics(
    long InputTokens, 
    long OutputTokens, 
    TimeSpan Duration);
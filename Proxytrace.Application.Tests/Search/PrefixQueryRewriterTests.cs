using AwesomeAssertions;
using Proxytrace.Application.Search.Internal;

namespace Proxytrace.Application.Tests.Search;

[TestClass]
public sealed class PrefixQueryRewriterTests
{
    [TestMethod]
    [DataRow("chan", "*chan*")]
    [DataRow("chan channel", "*chan* *channel*")]
    [DataRow("\"channel id\"", "\"channel id\"")]
    [DataRow("chan*", "chan*")]
    [DataRow("chan?el", "chan?el")]
    [DataRow("title:chan", "title:*chan*")]
    [DataRow("+chan -bot", "+*chan* -*bot*")]
    [DataRow("chan AND bot", "*chan* AND *bot*")]
    [DataRow("NOT chan", "NOT *chan*")]
    [DataRow("foo \"bar baz\" qux", "*foo* \"bar baz\" *qux*")]
    [DataRow("gpt-4.0", "*gpt-4.0*")]
    [DataRow("AND", "AND")]
    [DataRow("OR", "OR")]
    [DataRow("(chan OR bot)", "(*chan* OR *bot*)")]
    [DataRow("title:\"two words\"", "title:\"two words\"")]
    public void Rewrite_WrapsBareTokensWithWildcards(string input, string expected)
    {
        PrefixQueryRewriter.Rewrite(input).Should().Be(expected);
    }

    [TestMethod]
    [DataRow("")]
    [DataRow("   ")]
    [DataRow("\t")]
    public void Rewrite_PassthroughEmptyOrWhitespace(string input)
    {
        PrefixQueryRewriter.Rewrite(input).Should().Be(input);
    }
}

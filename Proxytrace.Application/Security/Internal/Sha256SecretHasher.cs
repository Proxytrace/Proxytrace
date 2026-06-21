using Proxytrace.Common.Security;

namespace Proxytrace.Application.Security.Internal;

internal sealed class Sha256SecretHasher : ISecretHasher
{
    public string Hash(string value) => Sha256.HexHash(value);
}

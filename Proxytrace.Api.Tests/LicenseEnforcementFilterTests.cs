using AwesomeAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using NSubstitute;
using Proxytrace.Api.Auth.Licensing;
using Proxytrace.Licensing;

namespace Proxytrace.Api.Tests;

[TestClass]
public sealed class LicenseEnforcementFilterTests
{
    public required TestContext TestContext { get; init; }

    private static AuthorizationFilterContext BuildContext(params object[] endpointMetadata)
    {
        var actionContext = new ActionContext(
            new DefaultHttpContext(),
            new RouteData(),
            new ActionDescriptor { EndpointMetadata = endpointMetadata });

        return new AuthorizationFilterContext(actionContext, []);
    }

    private static ILicenseService LicenseWith(params LicenseFeature[] enabled)
    {
        var service = Substitute.For<ILicenseService>();
        service.IsFeatureEnabled(Arg.Any<LicenseFeature>())
            .Returns(call => enabled.Contains(call.Arg<LicenseFeature>()));
        service.Current.Returns(new LicenseSnapshot(
            LicenseTier.Free, LicenseStatus.Free, null, null, null, null,
            new HashSet<LicenseFeature>(), new Dictionary<LicenseLimit, long>()));
        return service;
    }

    [TestMethod]
    public async Task NoRequirement_DoesNotShortCircuit()
    {
        var filter = new LicenseEnforcementFilter(LicenseWith());
        var context = BuildContext();

        await filter.OnAuthorizationAsync(context);

        context.Result.Should().BeNull();
    }

    [TestMethod]
    public async Task FeatureMissing_ReturnsPaymentRequired()
    {
        var filter = new LicenseEnforcementFilter(LicenseWith());
        var context = BuildContext(new RequiresFeatureAttribute(LicenseFeature.OptimizationProposals));

        await filter.OnAuthorizationAsync(context);

        context.Result.Should().BeOfType<ObjectResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status402PaymentRequired);
    }

    [TestMethod]
    public async Task FeatureGranted_DoesNotShortCircuit()
    {
        var filter = new LicenseEnforcementFilter(LicenseWith(LicenseFeature.OptimizationProposals));
        var context = BuildContext(new RequiresFeatureAttribute(LicenseFeature.OptimizationProposals));

        await filter.OnAuthorizationAsync(context);

        context.Result.Should().BeNull();
    }
}

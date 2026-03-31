using System.ComponentModel.DataAnnotations;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Domain;
using Trsr.Domain.Exceptions;
using Trsr.Domain.User;
using Trsr.Testing;
// ReSharper disable UnusedMember.Local

namespace Trsr.Storage.Tests;

[TestClass]
public class OptimisticConcurrencyTests : BaseTest<Module>
{
    [TestMethod]
    public async Task Update_WithConflict_Throws()
    {
        IServiceProvider services = GetServices();
        IUser user = await services.GetRequiredService<IDomainEntityGenerator<IUser>>()
            .GetOrCreateAsync(CancellationToken);
        
        var repo = services.GetRequiredService<IRepository<IUser>>();


        var modifier = new ConcurrentModifier(user);
        var factory = services.GetRequiredService<IUser.CreateExisting>();
        var modified = factory(modifier.Name, modifier);
        
        await FluentActions.Invoking(() => repo.UpdateAsync(modified, CancellationToken))
            .Should()
            .ThrowAsync<OptimisticConcurrencyException>();
    }

    private record ConcurrentModifier : IUser
    {
        private readonly IUser user;

        public Guid Id => user.Id;
        public DateTimeOffset CreatedAt => user.CreatedAt.Subtract(TimeSpan.FromHours(1));
        public DateTimeOffset UpdatedAt => user.UpdatedAt.Subtract(TimeSpan.FromHours(1));
        public string Name => user.Name + "_modifier";
        
        public ConcurrentModifier(IUser user)
        {
            this.user = user;
        }

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            return [];
        }
    }
}
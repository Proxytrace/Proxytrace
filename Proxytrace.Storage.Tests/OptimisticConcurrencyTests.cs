using System.ComponentModel.DataAnnotations;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Domain;
using Proxytrace.Domain.Exceptions;
using Proxytrace.Domain.User;
using Proxytrace.Testing;

// ReSharper disable UnusedMember.Local

namespace Proxytrace.Storage.Tests;

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
        var modified = factory(modifier.Email, modifier.ExternalSubject, modifier.PasswordHash, modifier.Role, modifier);

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
        public string Email => "modifier_" + user.Email;
        public string? ExternalSubject => user.ExternalSubject;
        public string? PasswordHash => user.PasswordHash;
        public UserRole Role => user.Role;

        public ConcurrentModifier(IUser user)
        {
            this.user = user;
        }

        public Task<IUser> ChangeRole(UserRole role, CancellationToken cancellationToken = default)
            => Task.FromResult<IUser>(this);

        public Task<IUser> ChangePasswordHash(string passwordHash, CancellationToken cancellationToken = default)
            => Task.FromResult<IUser>(this);

        public Task<IUser> ReloadAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IUser>(this);

        public Task<IUser> AddAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IUser>(this);

        public Task<IUser> UpdateAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IUser>(this);

        public Task<IUser> UpsertAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IUser>(this);

        public Task RemoveAsync(CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            return [];
        }
    }
}

# Domain Validation

Domain entities are validated by Autofac on activation (`OnActivated` runs `Validator.ValidateObject`) and again before repository `Add`/`Update`. Override `Validate(ValidationContext)` and yield `base.Validate(...)` first. Use helpers from `Proxytrace.Common.Validation`:

```csharp
Validation.NotNullOrWhiteSpace(Name, nameof(Name))   // note: capital S in "WhiteSpace"
Validation.NotNull(SystemEndpoint, nameof(SystemEndpoint))
Validation.NotDefault(SomeGuid, nameof(SomeGuid))
Validation.InPast(CreatedAt, nameof(CreatedAt))
Validation.NotBefore(UpdatedAt, CreatedAt, nameof(UpdatedAt))
```

For referenced entities, cascade validation:
```csharp
foreach (var r in SystemEndpoint.Validate(validationContext)) yield return r;
```

For a value constrained to a closed set that isn't an enum (e.g. `User.Language` must be one of the
`SupportedLanguages`), validate membership explicitly:
```csharp
yield return Validation.NotNullOrWhiteSpace(Language);
if (!SupportedLanguages.IsSupported(Language))
    yield return new ValidationResult($"Language '{Language}' is not a supported UI language.", [nameof(Language)]);
```

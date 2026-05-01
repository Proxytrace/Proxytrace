using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Common.Random;
using Trsr.Testing;

namespace Trsr.Common.Tests;

[TestClass]
public sealed class RandomTests : BaseTest<Module>
{
    private IRandom Random => GetServices().GetRequiredService<IRandom>();

    [TestMethod]
    public void SeededRandom_GeneratesSameValuesForSameSeed()
    {
        var value1 = Random.Int(min: 0, max: 100);
        var value2 = Random.Int(min: 0, max: 100);
        
        value1.Should().Be(value2);
    }
    
    [TestMethod]
    public void Bool_CanReturnTrueOrFalse()
    {
        // With multiple calls to the random, we should eventually see both true and false
        var results = new HashSet<bool>();
        var random = Random;
        for (int i = 0; i < 100; i++)
        {
            results.Add(random.Bool());
            if (results.Count == 2)
            {
                break;
            }
        }
        
        results.Count.Should().Be(2);
    }
    
    [TestMethod]
    public void Guid_ReturnsValidGuid()
    {
        var guid = Random.Guid();
        guid.Should().NotBe(Guid.Empty);
    }
    
    [TestMethod]
    public void Guid_GeneratesDifferentGuidsOnSuccessiveCalls()
    {
        var services = GetServices();
        var guid1 = services.GetRequiredService<IRandom>().Guid();
        var guid2 = services.GetRequiredService<IRandom>().Guid();
        
        guid1.Should().NotBe(guid2);
    }
    
    [TestMethod]
    public void String_ReturnsNonEmptyString()
    {
        var result = Random.String();
        result.Should().NotBeNullOrWhiteSpace();
    }
    
    [TestMethod]
    public void String_ReturnsStringComposedOfWords()
    {
        var result = Random.String();
        
        result.Should().NotBeNullOrWhiteSpace();
        result.Split(' ').Length.Should().BeGreaterThan(0);
    }
    
    [TestMethod]
    public void UniqueString_ReturnsNonEmptyString()
    {
        var result = Random.UniqueString();
        
        result.Should().NotBeNullOrWhiteSpace();
    }
    
    [TestMethod]
    public void UniqueString_ReturnsUniqueStringsOnSuccessiveCalls()
    {
        var strings = new HashSet<string>();

        var random = Random;
        for (int i = 0; i < 100; i++)
        {
            strings.Add(random.UniqueString());
        }
        
        strings.Count.Should().Be(100);
    }
    
    [TestMethod]
    public void UniqueString_ReturnsGuidFormatString()
    {
        var result = Random.UniqueString();
        
        // UniqueString returns a GUID string
        Guid.TryParse(result, out _).Should().BeTrue();
    }
    
    [TestMethod]
    public void Int_WithNoParameters_ReturnsNonNegativeInt()
    {
        var result = Random.Int();
        
        result.Should().BeGreaterThanOrEqualTo(0);
    }
    
    [TestMethod]
    public void Int_WithMinAndMax_ReturnsValueInRange()
    {
        var results = new List<int>();
        for (int i = 0; i < 50; i++)
        {
            results.Add(Random.Int(min: 10, max: 20));
        }
        
        results.Should().AllSatisfy(r => r.Should().BeGreaterThanOrEqualTo(10));
        results.Should().AllSatisfy(r => r.Should().BeLessThan(20));
    }
    
    [TestMethod]
    public void Int_WithMin_ReturnsValueGreaterThanOrEqualToMin()
    {
        var result = Random.Int(min: 50);
        
        result.Should().BeGreaterThanOrEqualTo(50);
    }
    
    [TestMethod]
    public void Int_WithMax_ReturnsValueLessThanMax()
    {
        var result = Random.Int(max: 50);
        
        result.Should().BeLessThan(50);
        result.Should().BeGreaterThanOrEqualTo(0);
    }
    
    [TestMethod]
    public void Int_WithSameRange_CanGenerateMultipleValues()
    {
        var results = new HashSet<int>();
        var random = Random;
        for (int i = 0; i < 100; i++)
        {
            results.Add(random.Int(min: 1, max: 100));
        }
        
        // Should generate more than one unique value
        results.Count.Should().BeGreaterThan(1);
    }
    
    [TestMethod]
    public void Any_ReturnsElementFromCollection()
    {
        var options = new List<string> { "apple", "banana", "cherry" };
        
        var result = Random.Any(options);
        
        options.Should().Contain(result);
    }
    
    [TestMethod]
    public void Any_CanReturnDifferentElements()
    {
        var random = Random; // Cache the instance to avoid getting new seeded instance each time
        var options = new List<int> { 1, 2, 3, 4, 5 };
        var results = new HashSet<int>();
        
        for (int i = 0; i < 100; i++)
        {
            results.Add(random.Any(options));
        }
        
        // Should return more than one distinct value over multiple calls
        results.Count.Should().BeGreaterThan(1);
    }
    
    [TestMethod]
    public void Any_WithSingleElement_ReturnsThatElement()
    {
        var options = new List<string> { "only" };
        
        var result = Random.Any(options);
        
        result.Should().Be("only");
    }
    
    [TestMethod]
    public void Any_WithGenericType_ReturnsCorrectType()
    {
        var options = new List<DateTimeOffset>
        {
            DateTimeOffset.Now,
            DateTimeOffset.UtcNow.AddDays(1)
        };

        var result = Random.Any(options);

        options.Should().Contain(result);
    }

    [TestMethod]
    public void Long_WithNoParameters_ReturnsNonNegativeLong()
    {
        var result = Random.Long();

        result.Should().BeGreaterThanOrEqualTo(0);
    }

    [TestMethod]
    public void Long_WithMinAndMax_ReturnsValueInRange()
    {
        var results = new List<long>();
        var random = Random;
        for (int i = 0; i < 50; i++)
        {
            results.Add(random.Long(min: 100, max: 200));
        }

        results.Should().AllSatisfy(r => r.Should().BeGreaterThanOrEqualTo(100));
        results.Should().AllSatisfy(r => r.Should().BeLessThan(200));
    }

    [TestMethod]
    public void Double_WithNoParameters_ReturnsBetweenZeroAndOne()
    {
        var results = new List<double>();
        var random = Random;
        for (int i = 0; i < 50; i++)
        {
            results.Add(random.Double());
        }

        results.Should().AllSatisfy(r => r.Should().BeGreaterThanOrEqualTo(0.0));
        results.Should().AllSatisfy(r => r.Should().BeLessThan(1.0));
    }

    [TestMethod]
    public void Double_WithMinAndMax_ReturnsValueInRange()
    {
        var results = new List<double>();
        var random = Random;
        for (int i = 0; i < 50; i++)
        {
            results.Add(random.Double(min: 5.0, max: 10.0));
        }

        results.Should().AllSatisfy(r => r.Should().BeGreaterThanOrEqualTo(5.0));
        results.Should().AllSatisfy(r => r.Should().BeLessThan(10.0));
    }

    [TestMethod]
    public void Enum_ReturnsValidEnumValue()
    {
        var result = Random.Enum<DayOfWeek>();

        System.Enum.IsDefined(result).Should().BeTrue();
    }

    [TestMethod]
    public void Enum_CanReturnDifferentValues()
    {
        var results = new HashSet<DayOfWeek>();
        var random = Random;
        for (int i = 0; i < 100; i++)
        {
            results.Add(random.Enum<DayOfWeek>());
        }

        results.Count.Should().BeGreaterThan(1);
    }

    [TestMethod]
    public void DateTimeOffset_WithNoParameters_ReturnsRecentDate()
    {
        var result = Random.DateTimeOffset();

        result.Should().BeBefore(DateTimeOffset.UtcNow.AddSeconds(1));
        result.Should().BeAfter(DateTimeOffset.UtcNow.AddYears(-1).AddSeconds(-1));
    }

    [TestMethod]
    public void DateTimeOffset_WithMinAndMax_ReturnsValueInRange()
    {
        var min = new DateTimeOffset(2020, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var max = new DateTimeOffset(2021, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var results = new List<DateTimeOffset>();
        var random = Random;
        for (int i = 0; i < 50; i++)
        {
            results.Add(random.DateTimeOffset(min: min, max: max));
        }

        results.Should().AllSatisfy(r => r.Should().BeOnOrAfter(min));
        results.Should().AllSatisfy(r => r.Should().BeOnOrBefore(max));
    }

    [TestMethod]
    public void Uri_ReturnsValidUri()
    {
        var result = Random.Uri();

        result.Should().NotBeNull();
        result.IsAbsoluteUri.Should().BeTrue();
        result.Scheme.Should().Be("https");
    }

    [TestMethod]
    public void Uri_GeneratesDifferentUrisOnSuccessiveCalls()
    {
        var uris = new HashSet<string>();
        var random = Random;
        for (int i = 0; i < 20; i++)
        {
            uris.Add(random.Uri().ToString());
        }

        uris.Count.Should().BeGreaterThan(1);
    }

    [TestMethod]
    public void Email_ReturnsValidEmailFormat()
    {
        var result = Random.Email();

        result.Should().NotBeNullOrWhiteSpace();
        result.Should().Contain("@");
        result.Split('@').Length.Should().Be(2);
        result.Split('@')[1].Should().Contain(".");
    }

    [TestMethod]
    public void Email_GeneratesDifferentEmailsOnSuccessiveCalls()
    {
        var emails = new HashSet<string>();
        var random = Random;
        for (int i = 0; i < 50; i++)
        {
            emails.Add(random.Email());
        }

        emails.Count.Should().BeGreaterThan(1);
    }
}
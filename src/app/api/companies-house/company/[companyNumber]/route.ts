import { NextRequest, NextResponse } from 'next/server';

const COMPANIES_HOUSE_API_URL = 'https://api.company-information.service.gov.uk';
const COMPANIES_HOUSE_API_KEY = process.env.COMPANIES_HOUSE_API_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: { companyNumber: string } }
) {
  const companyNumber = params.companyNumber;

  if (!companyNumber) {
    return NextResponse.json({ error: 'Company number is required' }, { status: 400 });
  }

  try {
    // If we have an API key, use it directly
    if (COMPANIES_HOUSE_API_KEY) {
      // Fetch company details
      const companyResponse = await fetch(
        `${COMPANIES_HOUSE_API_URL}/company/${companyNumber}`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${COMPANIES_HOUSE_API_KEY}:`).toString('base64')}`,
          },
        }
      );

      if (!companyResponse.ok) {
        return NextResponse.json(
          { error: 'Company not found' },
          { status: companyResponse.status }
        );
      }

      const companyData = await companyResponse.json();

      // Fetch officers
      const officersResponse = await fetch(
        `${COMPANIES_HOUSE_API_URL}/company/${companyNumber}/officers`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${COMPANIES_HOUSE_API_KEY}:`).toString('base64')}`,
          },
        }
      );

      let officers: any[] = [];
      if (officersResponse.ok) {
        const officersData = await officersResponse.json();
        // Filter for active directors only (not resigned)
        officers = (officersData.items || []).filter(
          (o: any) => o.officer_role === 'director' && (o.resigned_on === null || o.resigned_on === undefined)
        );
      }

      return NextResponse.json({
        company: companyData,
        officers: officers.map((o) => {
          // Parse name - Companies House format is usually "SURNAME, FORENAME MIDDLENAME"
          const nameParts = (o.name || '').split(',').map((s: string) => s.trim());
          const surname = nameParts[0] || '';
          const forename = nameParts.slice(1).join(' ') || '';
          
          return {
            name: o.name || '',
            forename: forename,
            surname: surname,
            date_of_birth: o.date_of_birth
              ? {
                  month: o.date_of_birth.month,
                  year: o.date_of_birth.year,
                }
              : null,
            appointed_on: o.appointed_on || '',
            nationality: o.nationality || '',
            occupation: o.occupation || '',
          };
        }),
      });
    } else {
      // No API key - return mock data for development
      console.warn('No Companies House API key found. Using mock data.');
      return NextResponse.json({
        company: {
          company_number: companyNumber,
          company_name: 'Example Company Ltd',
          company_status: 'active',
          registered_office_address: {
            address_line_1: '123 Example Street',
            locality: 'London',
            postal_code: 'SW1A 1AA',
            country: 'England',
          },
        },
        officers: [
          {
            name: 'Smith, John',
            forename: 'John',
            surname: 'Smith',
            appointed_on: '2020-01-15',
          },
          {
            name: 'Doe, Jane',
            forename: 'Jane',
            surname: 'Doe',
            appointed_on: '2019-06-01',
          },
        ],
      });
    }
  } catch (error) {
    console.error('Error fetching company details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch company details' },
      { status: 500 }
    );
  }
}


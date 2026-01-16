import { NextRequest, NextResponse } from 'next/server';

const COMPANIES_HOUSE_API_URL = 'https://api.company-information.service.gov.uk';
const COMPANIES_HOUSE_API_KEY = process.env.COMPANIES_HOUSE_API_KEY;

interface CompaniesHouseCompany {
  company_number: string;
  company_name: string;
  company_status: string;
  registered_office_address?: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    postal_code?: string;
    country?: string;
  };
}

interface CompaniesHouseSearchResult {
  items: Array<{
    company_number: string;
    title: string;
    company_status: string;
    address_snippet?: string;
    description?: string;
  }>;
  total_results: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query || query.length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
  }

  try {
    // If we have an API key, use it directly
    if (COMPANIES_HOUSE_API_KEY) {
      const response = await fetch(
        `${COMPANIES_HOUSE_API_URL}/search/companies?q=${encodeURIComponent(query)}&items_per_page=10`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${COMPANIES_HOUSE_API_KEY}:`).toString('base64')}`,
          },
        }
      );

      if (!response.ok) {
        console.error('Companies House API error:', response.status, response.statusText);
        return NextResponse.json(
          { error: 'Failed to search Companies House' },
          { status: response.status }
        );
      }

      const data: CompaniesHouseSearchResult = await response.json();

      // Format results for frontend
      const formattedResults = data.items.map((item) => ({
        company_number: item.company_number,
        company_name: item.title,
        status: item.company_status,
        address: item.address_snippet || item.description || '',
      }));

      return NextResponse.json({ results: formattedResults });
    } else {
      // No API key - return mock data for development
      console.warn('No Companies House API key found. Using mock data.');
      return NextResponse.json({
        results: [
          {
            company_number: '12345678',
            company_name: `${query} Ltd`,
            status: 'active',
            address: '123 Example Street, London, SW1A 1AA',
          },
        ],
      });
    }
  } catch (error) {
    console.error('Error searching Companies House:', error);
    return NextResponse.json(
      { error: 'Failed to search Companies House' },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';

const COMPANIES_HOUSE_API_URL = 'https://api.company-information.service.gov.uk';
const COMPANIES_HOUSE_API_KEY = process.env.COMPANIES_HOUSE_API_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: { number: string } }
) {
  const companyNumber = params.number;

  if (!companyNumber) {
    return NextResponse.json({ error: 'Company number is required' }, { status: 400 });
  }

  try {
    if (COMPANIES_HOUSE_API_KEY) {
      const response = await fetch(
        `${COMPANIES_HOUSE_API_URL}/company/${companyNumber}/officers`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${COMPANIES_HOUSE_API_KEY}:`).toString('base64')}`,
          },
        }
      );

      if (!response.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch officers' },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    } else {
      // No API key - return mock data for development
      console.warn('No Companies House API key found. Using mock data.');
      return NextResponse.json({
        items: [
          {
            name: 'Smith, John',
            officer_role: 'director',
            appointed_on: '2020-01-15',
            date_of_birth: {
              month: 5,
              year: 1980,
            },
          },
          {
            name: 'Doe, Jane',
            officer_role: 'director',
            appointed_on: '2019-06-01',
            date_of_birth: {
              month: 8,
              year: 1985,
            },
          },
        ],
      });
    }
  } catch (error) {
    console.error('Error fetching officers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch officers' },
      { status: 500 }
    );
  }
}


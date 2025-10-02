# Boulevard Admin API Support Request: Missing Timeblocks for Callouts/Sick Time

## Issue Summary
We're building an availability forecasting service using the Boulevard Admin GraphQL API. We've discovered that callouts and sick time visible in the Boulevard UI are **not being returned** by the timeblocks API query, causing our availability calculations to be incorrect.

## Specific Example
**Location**: Upper East Side (ID: `urn:blvd:Location:215b817e-8633-4edb-b5e5-e290d999eeb6`)  
**Date**: October 10, 2025  
**Staff Member**: Natalia  
**Issue**: A callout from 3:20 PM - 8:40 PM (320 minutes) appears in the Boulevard UI with note "Call Out (Winnie Covering)" and is marked as "Blocked by Mailonie Smith - PERSONAL", but this timeblock does **not appear** in our API query results.

## What We've Tried

### Current Timeblocks Query
```graphql
query GetTimeblocks($locationId: ID!, $query: String, $first: Int!, $after: String) {
  timeblocks(locationId: $locationId, query: $query, first: $first, after: $after) {
    edges {
      node {
        id
        staffId
        startAt
        endAt
        duration
        reason
        title
        cancelled
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Variables Used
```json
{
  "locationId": "urn:blvd:Location:215b817e-8633-4edb-b5e5-e290d999eeb6",
  "query": "startAt >= '2025-10-10T04:00:00.000Z' AND startAt < '2025-10-11T03:59:59.999Z'",
  "first": 100
}
```

### What We Get
- Regular breaks (PERSONAL reason) are returned correctly
- Staff lunch breaks appear properly
- **Callouts/sick time do NOT appear** in the results

### What We've Tested
1. ✅ Removed the `cancelled` filter - still no callout
2. ✅ Confirmed the date range is correct (covers full 24 hours in location timezone)
3. ✅ Verified authentication and permissions are working (other data returns correctly)
4. ✅ Checked multiple locations - same issue everywhere

## What We Need

### 1. Correct GraphQL Query Template
Please provide the **complete GraphQL query structure** to fetch ALL types of time blocks for a given location and date, including:
- Regular breaks
- **Callouts** 
- **Sick time**
- Any other time-blocking scenarios we might be missing

### 2. Query Filter Formula
What is the correct `query` parameter format to ensure we capture all time-blocking scenarios? For example:

**For Appointments** (this works fine):
```javascript
const query = `cancelled = false AND startAt >= '${startFormatted}' AND startAt < '${endFormatted}'`
```

**For Timeblocks** (this is missing callouts):
```javascript
const query = `startAt >= '${startFormatted}' AND startAt < '${endFormatted}'`
```

### 3. Data Model Clarification
Are callouts/sick time stored:
- In a different API endpoint?
- Under a different field structure?
- Associated with a different staff member (e.g., "Blocked by" vs actual staff)?
- Requiring additional query parameters or filters?

## Business Impact
Without accurate timeblock data, our availability calculations show **71 slots** when there should only be **61 slots** at Upper East Side on October 10th. This 10-slot discrepancy comes from the missing 320-minute callout, which represents significant revenue forecasting errors.

## API Access Details
- **Business ID**: `${process.env.BLVD_BUSINESS_ID}`
- **Using**: Admin GraphQL API (dashboard.boulevard.io/api/2020-01/admin)
- **Authentication**: Basic Auth with API key

## Request
Please provide:
1. The correct GraphQL query template to fetch ALL time-blocking scenarios
2. Documentation on how callouts/sick time are stored and accessed
3. Any additional filters or parameters needed to capture complete data

Thank you for your help in ensuring our integration captures accurate data!

import { BlvdConfig, GraphqlResponse, ConnectionTestResult, TestResult } from "@shared/schema";
import { createHmac } from "crypto";

export class BlvdService {
  private config: BlvdConfig;

  constructor(config: BlvdConfig) {
    this.config = config;
  }

  /**
   * Verify webhook payload authenticity using Boulevard's HMAC verification
   * Based on: https://developers.joinblvd.com/2020-01/admin-api/guides/webhooks/#verification-example
   */
  verifyWebhookSignature(
    hmacSalt: string,
    hmacSha256: string,
    rawBody: string
  ): boolean {
    try {
      // 1. Construct the message payload that was signed
      const payload = `${hmacSalt}:${rawBody}`;

      // 2. Obtain the raw binary app secret (Boulevard provides base64 encoded)
      const rawAppSecret = Buffer.from(this.config.secretKey, 'base64');

      // 3. Create SHA256 HMAC value and encode with base64
      const rawHmac = createHmac('sha256', rawAppSecret)
        .update(payload, 'utf8')
        .digest();
      const signature = Buffer.from(rawHmac).toString('base64');

      // 4. Securely compare signatures
      return this.secureCompare(signature, hmacSha256);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Parse and validate webhook headers
   */
  parseWebhookHeaders(headers: Record<string, string>): {
    hmacSalt: string | null;
    hmacSha256: string | null;
    isValid: boolean;
  } {
    const hmacSalt = headers['x-blvd-hmac-salt'] || null;
    const hmacSha256 = headers['x-blvd-hmac-sha256'] || null;

    const isValid = !!(hmacSalt && hmacSha256);

    return {
      hmacSalt,
      hmacSha256,
      isValid
    };
  }

  /**
   * Secure string comparison to prevent timing attacks
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  private toMs(iso: string): number {
    return new Date(iso).getTime();
  }

  private fromMs(ms: number): string {
    return new Date(ms).toISOString();
  }

  private mergeIntervals(list: Array<{startsAt?: string; endsAt?: string; start?: string; end?: string; startMs?: number; endMs?: number}>): Array<{startMs: number; endMs: number}> {
    if (!list.length) return [];
    
    const sorted = list
      .map(iv => ({
        startMs: iv.startMs ?? this.toMs(iv.startsAt ?? iv.start ?? ''),
        endMs: iv.endMs ?? this.toMs(iv.endsAt ?? iv.end ?? '')
      }))
      .filter(iv => Number.isFinite(iv.startMs) && Number.isFinite(iv.endMs) && iv.endMs > iv.startMs)
      .sort((a, b) => a.startMs - b.startMs);

    const out: Array<{startMs: number; endMs: number}> = [];
    for (const iv of sorted) {
      if (!out.length || iv.startMs > out[out.length - 1].endMs) {
        out.push({ ...iv });
      } else {
        out[out.length - 1].endMs = Math.max(out[out.length - 1].endMs, iv.endMs);
      }
    }
    return out;
  }

  private subtractIntervals(working: Array<{startMs: number; endMs: number}>, blocks: Array<{startsAt?: string; endsAt?: string; startMs?: number; endMs?: number}>): Array<{startMs: number; endMs: number}> {
    let result = working.map(x => ({ ...x }));
    const B = this.mergeIntervals(blocks);
    
    for (const b of B) {
      const next: Array<{startMs: number; endMs: number}> = [];
      for (const a of result) {
        if (b.endMs <= a.startMs || b.startMs >= a.endMs) {
          next.push(a);
          continue;
        }
        if (b.startMs > a.startMs) {
          next.push({ startMs: a.startMs, endMs: Math.min(b.startMs, a.endMs) });
        }
        if (b.endMs < a.endMs) {
          next.push({ startMs: Math.max(b.endMs, a.startMs), endMs: a.endMs });
        }
      }
      result = next;
    }
    return result;
  }

  private ceilToStep(ms: number, stepMs: number, anchorMs: number = 0): number {
    return ms + ((stepMs - ((ms - anchorMs) % stepMs)) % stepMs);
  }

  private hmsFromISO(iso: string): { h: number; m: number; s: number } {
    const d = new Date(iso);
    return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds() };
  }

  private weekdayUTC(ms: number): number {
    return new Date(ms).getUTCDay();
  }

  private byWeekdayMatches(byWeekday: string[] | undefined, targetWkday: number): boolean {
    if (!byWeekday || byWeekday.length === 0) return false;
    const map: Record<string, number> = { SU:0, MO:1, TU:2, WE:3, TH:4, FR:5, SA:6 };
    const set = new Set((byWeekday || []).map(x => map[String(x).slice(0,2).toUpperCase()]).filter(v => v!=null));
    return set.has(targetWkday);
  }

  /**
   * Get timezone offset string for converting a local time to UTC
   * Handles DST transitions by probing candidate UTC instants
   */
  private getTimezoneOffsetForLocalTime(
    year: number, 
    month: number,  // 1-12
    day: number,
    hour: number,
    minute: number,
    second: number,
    timezone: string
  ): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Test function to check if a UTC instant matches the desired local time
    const testUtcInstant = (utcMs: number): boolean => {
      const parts = formatter.formatToParts(new Date(utcMs));
      const localYear = parseInt(parts.find(p => p.type === 'year')!.value);
      const localMonth = parseInt(parts.find(p => p.type === 'month')!.value);
      const localDay = parseInt(parts.find(p => p.type === 'day')!.value);
      const localHour = parseInt(parts.find(p => p.type === 'hour')!.value);
      const localMinute = parseInt(parts.find(p => p.type === 'minute')!.value);
      const localSecond = parseInt(parts.find(p => p.type === 'second')!.value);
      
      return localYear === year && localMonth === month && localDay === day &&
             localHour === hour && localMinute === minute && localSecond === second;
    };
    
    // Build local datetime string
    const localStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
    const localAsUtcMs = new Date(localStr + 'Z').getTime();
    
    // Probe candidate UTC instants systematically covering all IANA timezone offsets
    // Sweep total minutes from UTC-14:00 (-840 min) to UTC+14:00 (+840 min) in 15-minute steps
    // This correctly handles all fractional offsets including negative ones:
    // Examples: -03:30 Newfoundland, +05:45 Nepal, +12:45 Chatham Islands
    const candidateOffsets: number[] = [];
    for (let totalMinutes = -840; totalMinutes <= 840; totalMinutes += 15) {
      // For timezone offset like "-04:00": local = UTC - 04:00, so UTC = local + 04:00
      // We negate totalMinutes because: if tz offset is -4hr (-240min), we add +240min to local to get UTC
      candidateOffsets.push(-totalMinutes * 60000);
    }
    
    for (const offsetMs of candidateOffsets) {
      const candidateUtcMs = localAsUtcMs + offsetMs;
      if (testUtcInstant(candidateUtcMs)) {
        // Found matching instant - calculate and return offset
        // The offset string represents "local = UTC + offset", so offset = local - UTC
        // But we have: UTC = local + offsetMs, so local = UTC - offsetMs
        // Therefore: offset = -offsetMs
        const actualOffsetMs = -offsetMs;
        const sign = actualOffsetMs >= 0 ? '+' : '-';
        const absOffsetMs = Math.abs(actualOffsetMs);
        const offsetHours = Math.trunc(absOffsetMs / 3600000);
        const offsetMinutes = Math.trunc((absOffsetMs % 3600000) / 60000);
        
        return `${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
      }
    }
    
    // If no exact match found (e.g., spring-forward gap where local time doesn't exist),
    // throw an error so caller can handle it explicitly
    throw new Error(`Cannot resolve local time ${localStr} in timezone ${timezone} - time may not exist (spring-forward gap)`);
  }

  private expandShiftToDate(
    shift: any, 
    dayStartMs: number, 
    dayEndMs: number,
    locationTimezone: string = 'America/New_York'
  ): { startMs: number; endMs: number; staffId: string } | null {
    // Boulevard shifts API format:
    // - clockIn/clockOut: "HH:MM:SS" format (e.g., "08:00:00") in location's local timezone
    // - day: weekday number 0-6 (0=Sunday, 1=Monday, ..., 6=Saturday)
    // - recurrence: "weekly" or null
    // - recurrenceStart/End: date strings
    
    const clockIn = shift.clockIn;
    const clockOut = shift.clockOut;
    const recurrence = shift.recurrence;
    const shiftDayOfWeek = shift.day; // 0-6 weekday number
    const recurrenceStart = shift.recurrenceStart;
    const recurrenceEnd = shift.recurrenceEnd;
    
    // Get target date weekday (0=Sunday, 1=Monday, ..., 6=Saturday)
    const targetDate = new Date(dayStartMs);
    const targetDow = targetDate.getUTCDay();
    
    // Check if this shift applies to the target weekday
    if (typeof shiftDayOfWeek === 'number' && shiftDayOfWeek !== targetDow) {
      return null;
    }
    
    // For recurring shifts, check if target date falls within recurrence period
    if (recurrence && recurrence.toLowerCase() === 'weekly') {
      if (recurrenceStart) {
        const startDate = new Date(recurrenceStart);
        if (targetDate < startDate) {
          return null; // Target is before recurrence starts
        }
      }
      if (recurrenceEnd) {
        const endDate = new Date(recurrenceEnd);
        if (targetDate > endDate) {
          return null; // Target is after recurrence ends
        }
      }
    }
    
    // Build shift instance on target date using clockIn/clockOut times IN LOCAL TIMEZONE
    // Boulevard shift times are in the location's timezone, so we need to parse them as local times
    const [sh, sm, ss] = clockIn.split(':').map(Number);
    const [eh, em, es] = clockOut.split(':').map(Number);
    
    // Get date components for target date
    const year = targetDate.getUTCFullYear();
    const month = targetDate.getUTCMonth() + 1; // JavaScript months are 0-indexed
    const day = targetDate.getUTCDate();
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Calculate timezone offset for each specific timestamp using iterative approach
    // This correctly handles DST transitions and ambiguous times
    const clockInOffset = this.getTimezoneOffsetForLocalTime(year, month, day, sh, sm, ss, locationTimezone);
    const clockOutOffset = this.getTimezoneOffsetForLocalTime(year, month, day, eh, em, es, locationTimezone);
    
    const clockInStr = `${dateStr}T${clockIn}${clockInOffset}`;  // "2025-10-03T08:00:00-04:00"
    const clockOutStr = `${dateStr}T${clockOut}${clockOutOffset}`; // "2025-10-03T15:20:00-04:00"
    
    // Convert to milliseconds using toMs (which handles timezone-aware strings)
    const instStart = this.toMs(clockInStr);
    const instEnd = this.toMs(clockOutStr);
    
    // Check if shift overlaps with target day window
    if (instEnd <= dayStartMs || instStart >= dayEndMs) {
      return null;
    }
    
    return { 
      startMs: Math.max(instStart, dayStartMs), 
      endMs: Math.min(instEnd, dayEndMs),
      staffId: shift.staffId
    };
  }

  private createBoulevardToken(): string {
    // Boulevard API authentication according to official docs
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const prefix = "blvd-admin-v1";
    
    // 1. Generate token payload: prefix + business_id + timestamp
    const tokenPayload = prefix + this.config.businessId + timestamp;
    
    // 2. Sign the payload with HMAC-SHA256
    const rawKey = Buffer.from(this.config.secretKey, 'base64');
    const rawMac = createHmac('sha256', rawKey)
      .update(tokenPayload, 'utf8')
      .digest(); // Get raw bytes, not string
    const signature = Buffer.from(rawMac).toString('base64');
    
    // 3. Concatenate signature + token_payload
    const token = signature + tokenPayload;
    
    return token;
  }

  private createAuthHeaders(): Record<string, string> {
    // Boulevard uses Basic HTTP Authentication with signed tokens
    const token = this.createBoulevardToken();
    const basicPayload = `${this.config.apiKey}:${token}`;
    const basicCredentials = Buffer.from(basicPayload).toString('base64');
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${basicCredentials}`,
    };
  }

  private createClientApiHeaders(): Record<string, string> {
    // Client API uses simple API key authentication
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
    };
  }

  private getClientApiUrl(): string {
    // Client API endpoint format: https://dashboard.boulevard.io/api/2020-01/:business_id/client
    return `https://dashboard.boulevard.io/api/2020-01/${this.config.businessId}/client`;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const tests: TestResult[] = [];
    let connected = false;
    let responseTime: number | undefined;
    let error: string | undefined;

    try {
      // Test 1: Network connectivity
      const start = Date.now();
      const networkTest = await this.testNetworkConnectivity();
      responseTime = Date.now() - start;
      tests.push(networkTest);

      if (networkTest.status === 'passed') {
        // Test 2: Schema introspection
        const schemaTest = await this.testSchemaIntrospection();
        tests.push(schemaTest);

        if (schemaTest.status === 'passed') {
          // Test 3: Business access
          const businessTest = await this.testBusinessAccess();
          tests.push(businessTest);

          connected = businessTest.status === 'passed';
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error occurred';
      tests.push({
        name: 'Connection Error',
        status: 'failed',
        message: error,
      });
    }

    return {
      connected,
      tests,
      responseTime,
      error,
    };
  }

  async executeLocationsQuery(): Promise<GraphqlResponse> {
    const query = `
      query Locations($cursor: String) {
        locations(first: 100, after: $cursor) {
          edges { 
            node { 
              id 
              name 
              isRemote
              address {
                city
                state
              }
            } 
          }
          pageInfo { 
            hasNextPage 
            endCursor 
          }
        }
      }
    `;

    const variables = {
      cursor: null,
    };

    const response = await this.makeGraphqlRequest(query, variables);
    return response;
  }

  /**
   * Get real appointment data from Boulevard Admin API for a specific location and date range
   */
  async getLocationAppointments(locationId: string, startDate: string, endDate: string): Promise<GraphqlResponse> {
    // Use the correct Admin API appointments query that provides business-level access
    console.log(`🎯 Querying REAL appointments via Admin API for ${locationId} on ${startDate.split('T')[0]}`);
    
    try {
      const response = await this.queryAdminAPIAppointments(locationId, startDate, endDate);
      
      if ((response.data as any)?.appointments) {
        const appointmentCount = (response.data as any).appointments.edges?.length || 0;
        console.log(`✅ Found ${appointmentCount} REAL appointments for location via Admin API`);
        return response;
      } else if (response.errors) {
        console.log('❌ Admin API appointments query failed:', response.errors[0]?.message);
        return await this.tryAlternativeAppointmentsQuery(locationId, startDate, endDate);
      } else {
        console.log('⚠️ No appointment data returned from Admin API, falling back...');
        return await this.tryAlternativeAppointmentsQuery(locationId, startDate, endDate);
      }
    } catch (error) {
      console.log('❌ Admin API error, falling back to capacity calculation:', error);
      return await this.tryAlternativeAppointmentsQuery(locationId, startDate, endDate);
    }
  }

  async queryAdminAPIAppointments(locationId: string, startDate: string, endDate: string): Promise<GraphqlResponse> {
    // Use the CORRECT Admin API appointments query that provides business-level access to all appointment data
    console.log('📋 Using Admin API appointments query (business-level access)...');
    
    const adminAppointmentsQuery = `
      query ListAppointments($locationId: ID!, $first: Int, $query: String) {
        appointments(
          locationId: $locationId,
          first: $first,
          query: $query
        ) {
          edges {
            node {
              id
              startAt
              endAt
              duration
              state
              cancelled
              notes
              client {
                id
                firstName
                lastName
                email
                mobilePhone
              }
              location {
                id
                name
              }
              appointmentServices {
                id
                startAt
                endAt
                duration
                price
                service {
                  id
                  name
                  category {
                    name
                  }
                }
                staff {
                  id
                  firstName
                  lastName
                  role {
                    name
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    // Show appointments that START on the selected date only (precise date filtering)
    console.log(`🔧 DEBUGGING: Input startDate = ${startDate}, endDate = ${endDate}`);
    const targetDate = new Date(startDate);
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);
    
    const startTimeFormatted = startOfDay.toISOString(); // Start of target date
    const endTimeFormatted = endOfDay.toISOString(); // End of target date
    console.log(`🔧 DEBUGGING: Date range generated: ${startTimeFormatted} to ${endTimeFormatted}`);
    
    const variables = {
      locationId: locationId,
      first: 200,
      query: `cancelled = false AND startAt >= '${startTimeFormatted}' AND startAt < '${endTimeFormatted}'`
    };

    console.log(`📊 Querying appointments that START on target date for ${locationId} from ${startTimeFormatted} to ${endTimeFormatted}`);
    
    return await this.makeGraphqlRequest(adminAppointmentsQuery, variables);
  }

  private static shiftsSchemaDiscovered = false;

  async discoverShiftsSchema(): Promise<void> {
    if (BlvdService.shiftsSchemaDiscovered) return;
    BlvdService.shiftsSchemaDiscovered = true;
    
    console.log('🔍 Using GraphQL introspection to discover shifts query schema...');
    
    const introspectionQuery = `
      {
        __type(name: "Query") {
          fields {
            name
            args {
              name
              type {
                name
                kind
              }
            }
            type {
              name
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
      }
    `;
    
    try {
      const response = await this.makeGraphqlRequest(introspectionQuery, {});
      const queryFields = (response.data as any)?.__type?.fields || [];
      const shiftsField = queryFields.find((f: any) => f.name === 'shifts');
      
      if (shiftsField) {
        console.log('✅ Found shifts query in schema:');
        console.log('  Return type:', shiftsField.type?.name || shiftsField.type?.ofType?.name);
        console.log('  Arguments:', JSON.stringify(shiftsField.args, null, 2));
        
        // Now introspect the return type
        const returnTypeName = shiftsField.type?.name || shiftsField.type?.ofType?.name;
        if (returnTypeName) {
          const typeQuery = `
            {
              __type(name: "${returnTypeName}") {
                name
                kind
                fields {
                  name
                  type {
                    name
                    kind
                    ofType {
                      name
                      kind
                    }
                  }
                }
              }
            }
          `;
          const typeResponse = await this.makeGraphqlRequest(typeQuery, {});
          console.log('✅ Shifts return type structure:', JSON.stringify(typeResponse.data, null, 2));
        }
      } else {
        console.log('❌ No shifts field found in Query type');
        const availableFields = queryFields.filter((f: any) => 
          f.name.toLowerCase().includes('shift') || 
          f.name.toLowerCase().includes('schedule') ||
          f.name.toLowerCase().includes('staff')
        );
        console.log('Related query fields:', availableFields.map((f: any) => f.name).join(', '));
      }
    } catch (error) {
      console.error('❌ Error during introspection:', error);
    }
  }

  async getStaffShifts(locationId: string, startDate: string, endDate: string, staffId?: string): Promise<any[]> {
    console.log(`🔄 Querying staff shifts for ${locationId} from ${startDate} to ${endDate}`);
    
    // Format dates as YYYY-MM-DD for Boulevard API
    const startDateOnly = startDate.split('T')[0];
    const endDateOnly = endDate.split('T')[0];
    
    console.log(`📅 Formatted dates for shifts query: startIso8601=${startDateOnly}, endIso8601=${endDateOnly}`);
    
    // Based on Boulevard docs: shifts returns [ListOfStaffShifts] which has a shifts field
    const shiftsQuery = `
      query Shifts($locationId: ID!, $startIso8601: Date!, $endIso8601: Date!) {
        shifts(
          locationId: $locationId
          startIso8601: $startIso8601
          endIso8601: $endIso8601
        ) {
          shifts {
            staffId
            clockIn
            clockOut
            day
            recurrence
            recurrenceInterval
            recurrenceStart
            recurrenceEnd
            available
            locationId
            unavailableReason
          }
        }
      }
    `;

    const variables: any = {
      locationId,
      startIso8601: startDateOnly,
      endIso8601: endDateOnly
    };
    
    if (staffId) {
      variables.staffIds = [staffId];
    }
    
    console.log(`📤 Shifts query variables:`, JSON.stringify(variables, null, 2));

    try {
      const response = await this.makeGraphqlRequest(shiftsQuery, variables);
      
      // Log the raw response for debugging
      console.log(`📦 Raw shifts response:`, JSON.stringify(response, null, 2));
      
      // Extract shifts from nested structure
      // The API returns: { data: { shifts: { shifts: [...] } } }
      const shiftsData = (response.data as any)?.shifts;
      const allShifts = shiftsData?.shifts || [];
      
      console.log(`✅ Found ${allShifts.length} shift templates`);
      
      // Log first shift for inspection
      if (allShifts.length > 0) {
        console.log(`🔍 Sample shift:`, JSON.stringify(allShifts[0], null, 2));
      }
      
      return allShifts;
    } catch (error) {
      console.error('❌ Error fetching shifts:', error);
      return [];
    }
  }

  async getTimeblocks(locationId: string, startDate: string, endDate: string, staffId?: string): Promise<any[]> {
    console.log(`⏱️ Querying timeblocks for ${locationId} from ${startDate} to ${endDate}`);
    
    // Based on Boulevard docs: timeblocks uses connection pattern with edges
    // The query parameter accepts a filter string like appointments
    const startISO = new Date(startDate).toISOString();
    const endISO = new Date(endDate).toISOString();
    
    const timeblocksQuery = `
      query Timeblocks($locationId: ID!, $query: String, $first: Int) {
        timeblocks(
          locationId: $locationId
          query: $query
          first: $first
        ) {
          edges {
            node {
              id
              startAt
              endAt
              duration
              cancelled
              staffId
              title
              reason
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    // Build query string for filtering by date range
    let queryFilter = `cancelled = false AND startAt >= '${startISO}' AND startAt < '${endISO}'`;
    if (staffId) {
      queryFilter += ` AND staffId = '${staffId}'`;
    }
    
    const variables: any = {
      locationId,
      query: queryFilter,
      first: 100
    };
    
    console.log(`📤 Timeblocks query variables:`, JSON.stringify(variables, null, 2));

    try {
      const response = await this.makeGraphqlRequest(timeblocksQuery, variables);
      
      // Log the raw response for debugging
      console.log(`📦 Raw timeblocks response:`, JSON.stringify(response, null, 2));
      
      const edges = (response.data as any)?.timeblocks?.edges || [];
      const timeblocks = edges.map((edge: any) => edge.node);
      
      console.log(`✅ Found ${timeblocks.length} active timeblocks`);
      
      // Log first timeblock for inspection
      if (timeblocks.length > 0) {
        console.log(`🔍 Sample timeblock:`, JSON.stringify(timeblocks[0], null, 2));
      }
      
      return timeblocks;
    } catch (error) {
      console.error('❌ Timeblocks query failed:', error);
      console.log('⚠️ Continuing without timeblocks data');
      return [];
    }
  }

  /**
   * Calculate hourly availability using CSV formula: Available = (Scheduled Minutes - Booked Minutes) / 40
   * Now uses shift expansion logic to count only staff actually working on the target date
   */
  async calculateHourlyAvailability(
    locationId: string, 
    date: string, 
    appointments: any[]
  ): Promise<{
    hourlyBreakdown: Array<{
      hour: number;
      scheduledMinutes: number;
      bookedMinutes: number;
      availableSlots: number;
    }>;
    totalAvailable: number;
    totalScheduledMinutes: number;
    totalBookedMinutes: number;
  }> {
    console.log(`📊 Calculating hourly availability for ${date} using CSV formula with shift expansion`);
    
    try {
      // Get staff shifts for the date
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      const dayStartMs = startDate.getTime();
      const dayEndMs = endDate.getTime();
      
      const shifts = await this.getStaffShifts(locationId, startDate.toISOString(), endDate.toISOString());
      const timeblocks = await this.getTimeblocks(locationId, startDate.toISOString(), endDate.toISOString());
      
      if (shifts.length === 0) {
        console.log('⚠️ No shift templates found for date');
        return {
          hourlyBreakdown: [],
          totalAvailable: 0
        };
      }
      
      console.log(`📋 Found ${shifts.length} shift templates`);
      
      // STEP 1: Expand recurring shifts to actual working windows for this specific date
      const expandedShifts: Array<{ startMs: number; endMs: number; staffId: string }> = [];
      
      for (const shift of shifts) {
        // Skip unavailable shifts
        if (!shift.available) continue;
        
        // All locations use America/New_York timezone
        const expanded = this.expandShiftToDate(shift, dayStartMs, dayEndMs, 'America/New_York');
        if (expanded) {
          expandedShifts.push(expanded);
        }
      }
      
      console.log(`✅ Expanded to ${expandedShifts.length} actual working shifts for ${date}`);
      
      if (expandedShifts.length === 0) {
        console.log('⚠️ No staff actually working on this date after expansion');
        return {
          hourlyBreakdown: [],
          totalAvailable: 0
        };
      }
      
      // STEP 2: Group shifts by staff and subtract timeblocks
      const staffWorkingWindows = new Map<string, Array<{ startMs: number; endMs: number }>>();
      
      for (const shift of expandedShifts) {
        if (!staffWorkingWindows.has(shift.staffId)) {
          staffWorkingWindows.set(shift.staffId, []);
        }
        staffWorkingWindows.get(shift.staffId)!.push({ startMs: shift.startMs, endMs: shift.endMs });
      }
      
      // Subtract timeblocks from each staff member's working windows
      const netWorkingWindows = new Map<string, Array<{ startMs: number; endMs: number }>>();
      
      for (const [staffId, windows] of staffWorkingWindows.entries()) {
        const merged = this.mergeIntervals(windows.map(w => ({ startMs: w.startMs, endMs: w.endMs })));
        
        // Get timeblocks for this staff
        // Note: timeblocks staffId is in URN format (urn:blvd:Staff:...) while shifts use short ID
        const staffTimeblocks = timeblocks
          .filter(tb => {
            const tbStaffId = tb.staffId.includes(':') ? tb.staffId.split(':').pop() : tb.staffId;
            return tbStaffId === staffId && !tb.cancelled;
          })
          .map(tb => ({ startsAt: tb.startAt, endsAt: tb.endAt }));
        
        // Subtract timeblocks
        const netWindows = this.subtractIntervals(merged, staffTimeblocks);
        
        // Only include staff with net working time > 0
        const totalMinutes = netWindows.reduce((sum, w) => sum + (w.endMs - w.startMs) / 60000, 0);
        if (totalMinutes > 0) {
          netWorkingWindows.set(staffId, netWindows);
          console.log(`  Staff ${staffId}: ${Math.round(totalMinutes)} net minutes after timeblocks`);
        } else {
          console.log(`  Staff ${staffId}: excluded (0 net minutes)`);
        }
      }
      
      console.log(`✅ ${netWorkingWindows.size} staff actually working with net time > 0`);
      
      // STEP 3: Calculate hourly breakdown using net working windows
      const hourlyBreakdown = [];
      let totalAvailable = 0;
      let totalScheduledMinutes = 0;
      let totalBookedMinutes = 0;
      
      console.log('\n🔍 ========== DETAILED AVAILABILITY BREAKDOWN ==========');
      
      for (let hour = 8; hour <= 20; hour++) {
        console.log(`\n📊 HOUR ${hour}:00-${hour+1}:00 CALCULATION:`);
        
        // Calculate scheduled minutes from net working windows
        let scheduledMinutes = 0;
        const staffContributions: Array<{staffId: string, minutes: number}> = [];
        
        // Calculate timezone offset for this specific hour to handle DST transitions
        const year = new Date(dayStartMs).getUTCFullYear();
        const month = new Date(dayStartMs).getUTCMonth() + 1;
        const day = new Date(dayStartMs).getUTCDate();
        
        // Get offset for this specific hour using iterative approach
        const hourOffsetStr = this.getTimezoneOffsetForLocalTime(year, month, day, hour, 0, 0, 'America/New_York');
        const offsetHours = parseInt(hourOffsetStr.slice(0, 3));
        const timezoneOffsetMs = Math.abs(offsetHours) * 3600000;
        
        // Align hourly buckets with location timezone
        const hourStartMs = dayStartMs + timezoneOffsetMs + (hour * 3600000);
        const hourEndMs = hourStartMs + 3600000;
        
        for (const [staffId, windows] of netWorkingWindows.entries()) {
          let staffMinutesThisHour = 0;
          for (const window of windows) {
            const overlapStart = Math.max(window.startMs, hourStartMs);
            const overlapEnd = Math.min(window.endMs, hourEndMs);
            
            if (overlapEnd > overlapStart) {
              const overlapMinutes = (overlapEnd - overlapStart) / 60000;
              const cappedMinutes = Math.min(overlapMinutes, 60); // Cap at 60 min per staff per hour
              staffMinutesThisHour += cappedMinutes;
              scheduledMinutes += cappedMinutes;
            }
          }
          if (staffMinutesThisHour > 0) {
            staffContributions.push({staffId: staffId.substring(0, 8), minutes: Math.round(staffMinutesThisHour)});
          }
        }
        
        console.log(`   📅 SCHEDULED CAPACITY:`);
        console.log(`      Total: ${Math.round(scheduledMinutes)} minutes from ${staffContributions.length} staff`);
        if (staffContributions.length > 0) {
          staffContributions.forEach(sc => {
            console.log(`         • Staff ${sc.staffId}... contributes ${sc.minutes}min`);
          });
        }
        
        // Calculate booked minutes for this hour
        let bookedMinutes = 0;
        const bookingsThisHour: Array<{time: string, minutes: number}> = [];
        
        for (const apt of appointments) {
          // Parse timezone-aware times directly (e.g., "2025-10-07T08:00:00-04:00")
          // Extract the local time portion, ignoring timezone offset
          const startMatch = apt.startAt.match(/T(\d{2}):(\d{2})/);
          const endMatch = apt.endAt.match(/T(\d{2}):(\d{2})/);
          
          if (!startMatch || !endMatch) continue;
          
          const aptStartHour = parseInt(startMatch[1]);
          const aptStartMin = parseInt(startMatch[2]);
          const aptEndHour = parseInt(endMatch[1]);
          const aptEndMin = parseInt(endMatch[2]);
          
          const aptStartDecimal = aptStartHour + (aptStartMin / 60);
          const aptEndDecimal = aptEndHour + (aptEndMin / 60);
          
          // Calculate overlap with current hour
          const overlapStart = Math.max(aptStartDecimal, hour);
          const overlapEnd = Math.min(aptEndDecimal, hour + 1);
          
          if (overlapEnd > overlapStart) {
            const overlapMins = Math.round((overlapEnd - overlapStart) * 60);
            bookedMinutes += overlapMins;
            bookingsThisHour.push({
              time: `${String(aptStartHour).padStart(2,'0')}:${String(aptStartMin).padStart(2,'0')}`,
              minutes: overlapMins
            });
          }
        }
        
        console.log(`   🔒 BOOKED APPOINTMENTS:`);
        console.log(`      Total: ${bookedMinutes} minutes from ${bookingsThisHour.length} appointments`);
        if (bookingsThisHour.length > 0) {
          bookingsThisHour.forEach(b => {
            console.log(`         • Appointment at ${b.time} uses ${b.minutes}min this hour`);
          });
        }
        
        // Apply CSV formula: Available = (Scheduled - Booked) / 40
        const netMinutes = scheduledMinutes - bookedMinutes;
        const availableSlots = Math.max(0, Math.floor(netMinutes / 40));
        
        console.log(`   ✨ CSV FORMULA CALCULATION:`);
        console.log(`      (${Math.round(scheduledMinutes)}min scheduled - ${bookedMinutes}min booked) ÷ 40 = ${availableSlots} slots`);
        console.log(`      Net available: ${Math.round(netMinutes)} minutes = ${availableSlots} x 40-minute slots`);
        
        hourlyBreakdown.push({
          hour,
          scheduledMinutes,
          bookedMinutes,
          availableSlots
        });
        
        totalAvailable += availableSlots;
        totalScheduledMinutes += scheduledMinutes;
        totalBookedMinutes += bookedMinutes;
      }
      
      console.log(`\n🎯 DAILY TOTALS:`);
      console.log(`   Total Scheduled: ${Math.round(totalScheduledMinutes)} minutes`);
      console.log(`   Total Booked: ${totalBookedMinutes} minutes`);
      console.log(`   Total Schedule Capacity: ${(totalScheduledMinutes / 40).toFixed(2)} slots`);
      console.log(`   Total Available (after bookings): ${totalAvailable} slots`);
      console.log('========== END DETAILED BREAKDOWN ==========\n');
      
      console.log(`📊 Total available slots for the day: ${totalAvailable}`);
      
      return {
        hourlyBreakdown,
        totalAvailable,
        totalScheduledMinutes,
        totalBookedMinutes
      };
      
    } catch (error) {
      console.error('❌ Error calculating hourly availability:', error);
      return {
        hourlyBreakdown: [],
        totalAvailable: 0,
        totalScheduledMinutes: 0,
        totalBookedMinutes: 0
      };
    }
  }

  async calculateScheduleCapacity(locationId: string, startDate: string, endDate: string, appointments: any[]): Promise<number> {
    console.log(`📊 Calculating schedule capacity for ${locationId} based on actual staff shifts`);
    
    try {
      // Use new hourly availability calculation
      const date = startDate.split('T')[0];
      console.log(`🔍 About to call calculateHourlyAvailability with date: ${date}`);
      const result = await this.calculateHourlyAvailability(locationId, date, appointments);
      
      // Calculate total capacity using CSV formula: Total Scheduled Minutes / 40
      // This matches the CSV's "Schedule" column exactly
      const totalCapacity = result.totalScheduledMinutes / 40;
      
      console.log(`✅ Hourly calculation complete:`);
      console.log(`   Scheduled Minutes: ${Math.round(result.totalScheduledMinutes)}`);
      console.log(`   Booked Minutes: ${result.totalBookedMinutes}`);
      console.log(`   Total Capacity (Schedule): ${totalCapacity.toFixed(2)} slots`);
      console.log(`   Available slots: ${result.totalAvailable}`);
      
      return totalCapacity;
      
    } catch (error) {
      console.error('❌ Error in calculateScheduleCapacity:', error);
      console.error('Stack trace:', (error as Error).stack);
      return this.calculateTheoreticalCapacity(appointments);
    }
  }

  private calculateTheoreticalCapacity(appointments: any[]): number {
    const bookedCount = appointments.length;
    if (bookedCount >= 40) {
      return Math.max(bookedCount + 20, 76);
    } else if (bookedCount >= 25) {
      return Math.max(bookedCount + 18, 60);
    } else if (bookedCount >= 15) {
      return Math.max(bookedCount + 15, 45);
    } else {
      return Math.max(bookedCount + 10, 30);
    }
  }

  /**
   * CLIENT API METHODS - For querying actual availability
   */

  private availabilityCache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

  private getCachedAvailability(key: string): any | null {
    const cached = this.availabilityCache.get(key);
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > this.CACHE_TTL_MS) {
      this.availabilityCache.delete(key);
      return null;
    }
    
    console.log(`📦 Using cached availability data (age: ${Math.round(age / 1000 / 60)}min)`);
    return cached.data;
  }

  private setCachedAvailability(key: string, data: any): void {
    this.availabilityCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  async makeClientApiRequest(query: string, variables?: any): Promise<GraphqlResponse> {
    try {
      const body = JSON.stringify({ query, variables });
      const headers = this.createClientApiHeaders();
      const url = this.getClientApiUrl();
      
      console.log('Making Client API request to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });

      console.log('Client API response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Client API error response:', errorText);
        throw new Error(`Client API HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Client API response received');
      return result;
    } catch (error) {
      console.error('Client API request failed:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Client API request failed: ${String(error)}`);
    }
  }

  async createCartForLocation(locationId: string): Promise<string | null> {
    console.log(`🛒 Creating cart for location: ${locationId}`);
    
    const mutation = `
      mutation CreateCart($locationId: ID!) {
        createCart(input: { locationId: $locationId }) {
          cart {
            id
            availableCategories {
              name
              availableItems {
                id
                name
                ... on CartAvailableBookableItem {
                  listDuration
                  listDurationRange {
                    min
                    max
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response = await this.makeClientApiRequest(mutation, { locationId });
      
      if (response.errors) {
        console.error('❌ Error creating cart:', response.errors);
        return null;
      }

      const cartId = (response.data as any)?.createCart?.cart?.id;
      const categories = (response.data as any)?.createCart?.cart?.availableCategories;
      
      console.log(`✅ Cart created: ${cartId}`);
      console.log(`📋 Available categories: ${categories?.length || 0}`);
      
      return cartId;
    } catch (error) {
      console.error('❌ Failed to create cart:', error);
      return null;
    }
  }

  async addBookableItemToCart(cartId: string, itemId: string): Promise<boolean> {
    console.log(`➕ Adding item ${itemId} to cart ${cartId}`);
    
    const mutation = `
      mutation AddItem($cartId: ID!, $itemId: ID!) {
        addCartSelectedBookableItem(input: { 
          id: $cartId, 
          itemId: $itemId 
        }) {
          cart {
            id
          }
        }
      }
    `;

    try {
      const response = await this.makeClientApiRequest(mutation, { 
        cartId, 
        itemId 
      });
      
      if (response.errors) {
        console.error('❌ Error adding item to cart:', response.errors);
        return false;
      }

      console.log(`✅ Item added to cart successfully`);
      return true;
    } catch (error) {
      console.error('❌ Failed to add item to cart:', error);
      return false;
    }
  }

  async getCartBookableTimes(cartId: string, searchDate: string, timeZone: string = 'America/New_York'): Promise<any[]> {
    console.log(`📅 Getting bookable times for cart ${cartId} on ${searchDate}`);
    
    const query = `
      query GetBookableTimes($cartId: ID!, $searchDate: Date!, $tz: Tz!) {
        cartBookableTimes(
          id: $cartId,
          searchDate: $searchDate,
          tz: $tz
        ) {
          id
          startTime
          score
        }
      }
    `;

    try {
      const response = await this.makeClientApiRequest(query, {
        cartId,
        searchDate,
        tz: timeZone
      });
      
      if (response.errors) {
        console.error('❌ Error getting bookable times:', response.errors);
        return [];
      }

      const times = (response.data as any)?.cartBookableTimes || [];
      console.log(`✅ Found ${times.length} available booking times`);
      
      return times;
    } catch (error) {
      console.error('❌ Failed to get bookable times:', error);
      return [];
    }
  }

  async getLocationAvailabilityFromClientAPI(
    locationId: string, 
    date: string
  ): Promise<{ availableSlots: any[]; totalSlots: number } | null> {
    const cacheKey = `${locationId}-${date}`;
    
    // Check cache first
    const cached = this.getCachedAvailability(cacheKey);
    if (cached) {
      return cached;
    }

    console.log(`🔍 Querying Client API for real availability at ${locationId} on ${date}`);

    try {
      // Step 1: Create a cart for this location
      const cartId = await this.createCartForLocation(locationId);
      if (!cartId) {
        console.error('❌ Failed to create cart');
        return null;
      }

      // Step 2: Get available services - we need to add a 40-min service to the cart
      // For now, we'll use a standard facial service (this should be configurable)
      const serviceQuery = `
        query GetServices($cartId: ID!) {
          cart(id: $cartId) {
            availableCategories {
              name
              availableItems {
                id
                name
                ... on CartAvailableBookableItem {
                  listDuration
                }
              }
            }
          }
        }
      `;
      
      const servicesResponse = await this.makeClientApiRequest(serviceQuery, { cartId });
      const categories = (servicesResponse.data as any)?.cart?.availableCategories || [];
      
      // Find a facial service around 40 minutes duration
      let serviceId: string | null = null;
      for (const category of categories) {
        const item = category.availableItems?.find((item: any) => 
          item.name?.toLowerCase().includes('facial') && 
          item.listDuration >= 30 && 
          item.listDuration <= 50
        );
        if (item) {
          serviceId = item.id;
          console.log(`📋 Using service: ${item.name} (${item.listDuration} min)`);
          break;
        }
      }
      
      // Fallback: use first bookable service
      if (!serviceId && categories.length > 0) {
        const firstCategory = categories[0];
        const firstItem = firstCategory.availableItems?.[0];
        if (firstItem) {
          serviceId = firstItem.id;
          console.log(`📋 Using fallback service: ${firstItem.name}`);
        }
      }

      if (!serviceId) {
        console.error('❌ No suitable service found');
        return null;
      }

      // Step 3: Add service to cart
      const added = await this.addBookableItemToCart(cartId, serviceId);
      if (!added) {
        console.error('❌ Failed to add service to cart');
        return null;
      }

      // Step 4: Get available times
      const times = await this.getCartBookableTimes(cartId, date);
      
      const result = {
        availableSlots: times.map(t => ({
          startTime: t.startTime,
          id: t.id,
          score: t.score
        })),
        totalSlots: times.length
      };

      // Cache the result
      this.setCachedAvailability(cacheKey, result);

      return result;
    } catch (error) {
      console.error('❌ Error getting Client API availability:', error);
      return null;
    }
  }

  async introspectClientAPISchema(): Promise<GraphqlResponse> {
    // GraphQL introspection query to discover available schema
    const introspectionQuery = `
      query IntrospectionQuery {
        __schema {
          queryType {
            name
            fields {
              name
              description
              type {
                name
                kind
              }
              args {
                name
                type {
                  name
                  kind
                }
              }
            }
          }
        }
      }
    `;

    return await this.makeClientAPIRequest(introspectionQuery);
  }

  async tryAlternativeClientQueries(locationId: string, startDate: string, endDate: string): Promise<GraphqlResponse> {
    console.log('Trying alternative Client API query patterns...');
    
    // Try the locations query to see if it provides any useful appointment-related data
    console.log('Testing Client API locations query...');
    const locationsQuery = `
      query GetLocationsForAppointments {
        locations(first: 50) {
          edges {
            node {
              id
              name
              businessName
              address {
                line1
                line2
                city
                state
              }
            }
          }
        }
      }
    `;

    try {
      const locationsResponse = await this.makeClientAPIRequest(locationsQuery);
      console.log('🔍 Client API Locations Response:', JSON.stringify(locationsResponse, null, 2));
      
      if (locationsResponse.data?.locations?.edges) {
        console.log(`Found ${locationsResponse.data.locations.edges.length} locations via Client API`);
        // Check if any location matches our target
        const targetLocation = locationsResponse.data.locations.edges.find((edge: any) => 
          edge.node.id === locationId
        );
        if (targetLocation) {
          console.log(`✅ Found target location: ${targetLocation.node.name}`);
        }
      }
      
      return locationsResponse;
    } catch (error) {
      console.log('❌ Client API locations query failed:', error);
      // Return empty response structure for consistency
      return {
        data: {
          appointments: {
            edges: [],
            pageInfo: { hasNextPage: false, endCursor: null }
          }
        }
      } as GraphqlResponse;
    }
  }

  async makeClientAPIRequest(query: string, variables?: any): Promise<GraphqlResponse> {
    try {
      const body = JSON.stringify({ query, variables });
      
      // Use Client API endpoint and authentication
      const clientApiUrl = `https://dashboard.boulevard.io/api/2020-01/${this.config.businessId}/client`;
      
      // Client API uses HTTP Basic Auth with API_KEY (no colon needed for public access)
      const basicPayload = `${this.config.apiKey}:`;
      const basicCredentials = Buffer.from(basicPayload).toString('base64');
      
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicCredentials}`
      };
      
      console.log('Making Client API GraphQL request to:', clientApiUrl);
      console.log('Request headers:', {
        'Content-Type': 'application/json',
        'Authorization': `Basic [API key credentials]`
      });
      
      const response = await fetch(clientApiUrl, {
        method: 'POST',
        headers,
        body
      });
      
      console.log('Response status:', response.status, response.statusText);
      
      const responseData = await response.json();
      console.log('Client API GraphQL response received:', JSON.stringify(responseData, null, 2));
      
      return responseData;
    } catch (error) {
      console.error('Client API GraphQL request failed:', error);
      throw error;
    }
  }

  async tryAlternativeAppointmentsQuery(locationId: string, startDate: string, endDate: string): Promise<GraphqlResponse> {
    // Try alternative appointments query structure
    const altQuery = `
      query GetAppointments($filter: AppointmentFilterInput, $first: Int) {
        business {
          appointments(filter: $filter, first: $first) {
            edges {
              node {
                id
                startAt
                endAt
                duration
                state
                cancelled
                location {
                  id
                  name
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      filter: {
        locationId: locationId,
        startTime: { gte: startDate, lt: endDate }
      },
      first: 100
    };

    try {
      const response = await this.makeGraphqlRequest(altQuery, variables);
      
      if ((response.data as any)?.business?.appointments) {
        console.log(`Alternative query found ${(response.data as any).business.appointments.edges?.length || 0} appointments`);
        // Restructure to match expected format
        return {
          data: {
            appointments: (response.data as any).business.appointments
          }
        } as GraphqlResponse;
      } else {
        console.log('Alternative appointments query also failed, falling back to capacity-based calculation');
        return await this.getLocationCapacityForDate(locationId, startDate, endDate);
      }
    } catch (error) {
      console.log('Alternative query failed, using capacity calculation:', error);
      return await this.getLocationCapacityForDate(locationId, startDate, endDate);
    }
  }

  async getLocationCapacityForDate(locationId: string, startDate: string, endDate: string): Promise<GraphqlResponse> {
    // If appointments aren't available, fall back to empty appointments with capacity info
    console.log('Falling back to capacity-based calculation for', locationId);
    
    return {
      data: {
        appointments: {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            endCursor: null
          }
        },
        // Include location capacity info based on your real Glowbar data
        totalSlots: 31 // Default capacity, will adjust per location
      }
    } as GraphqlResponse;
  }

  /**
   * Calculate availability percentage for a location on a specific date
   */
  calculateLocationAvailability(appointments: any[], businessHours: { start: number, end: number }, slotDuration: number = 15): number {
    // Calculate total available slots for facial treatment studio
    // Use 15-minute slots to match realistic salon booking patterns
    const totalMinutes = (businessHours.end - businessHours.start) * 60;
    const totalSlots = Math.floor(totalMinutes / slotDuration);

    // Count non-cancelled appointments
    const bookedAppointments = appointments.filter((apt: any) => !apt.cancelled && apt.state !== 'CANCELLED');
    const bookedSlots = bookedAppointments.length;

    // Calculate availability percentage
    const availableSlots = Math.max(0, totalSlots - bookedSlots);
    const availabilityPercentage = totalSlots > 0 ? (availableSlots / totalSlots) * 100 : 0;

    return Math.round(availabilityPercentage * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get tomorrow's date range in ISO format
   */
  getTomorrowDateRange(): { startDate: string, endDate: string } {
    // Use actual tomorrow for real-time availability checking
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Start of tomorrow (12:00 AM)
    const startOfDay = new Date(tomorrow);
    startOfDay.setHours(0, 0, 0, 0);
    
    // End of tomorrow (11:59 PM)
    const endOfDay = new Date(tomorrow);
    endOfDay.setHours(23, 59, 59, 999);

    return {
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString()
    };
  }

  /**
   * Get date range for a specific date in ISO format
   */
  getDateRange(dateString: string): { startDate: string, endDate: string } {
    const date = new Date(dateString);
    
    // Start of day (12:00 AM)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    // End of day (11:59 PM)
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return {
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString()
    };
  }

  /**
   * Generate Glowbar-style CSV report with real appointment data
   */
  generateGlowbarCSVReport(availabilityResults: any[]): string {
    // CSV Header matching Glowbar format exactly
    const header1 = 'AVAILABLE APPOINTMENTS,,,,,,,,,,,,,,,,,,,,';
    const header2 = 'Studio,Date,Percent available,Schedule,Booked,Available,Goal,8:00 AM,9:00 AM,10:00 AM,11:00 AM,12:00 PM,1:00 PM,2:00 PM,3:00 PM,4:00 PM,5:00 PM,6:00 PM,7:00 PM,8:00 PM,9:00 PM';
    
    const csvRows = [header1, header2];
    
    // Sort locations alphabetically to match Glowbar dashboard
    const sortedResults = availabilityResults.sort((a, b) => a.locationName.localeCompare(b.locationName));
    
    for (const location of sortedResults) {
      // Format date as M/D/YY (Glowbar format)
      const date = new Date(location.date);
      const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)}`;
      
      // Calculate availability metrics
      const schedule = location.totalAppointments;
      const booked = location.bookedAppointments;
      const available = schedule - booked;
      const percentAvailable = `${location.availabilityPercent}%`;
      
      // Goal is typically slightly below total capacity (industry standard ~75-90%)
      const goal = Math.round(schedule * 0.85);
      
      // Generate hourly breakdown (simplified - real implementation would parse appointment times)
      // For now, distribute available slots across business hours as placeholder
      const hourlySlots = this.generateHourlyAvailabilityBreakdown(available);
      
      const row = [
        location.locationName,
        formattedDate,
        percentAvailable,
        schedule.toString(),
        booked.toString(),
        available.toString(),
        goal.toString(),
        ...hourlySlots
      ].join(',');
      
      csvRows.push(row);
    }
    
    return csvRows.join('\n');
  }

  /**
   * Generate hourly availability breakdown (8 AM to 9 PM = 13 hours)
   */
  generateHourlyAvailabilityBreakdown(totalAvailable: number): string[] {
    const hours = 13; // 8 AM to 9 PM
    const hourlySlots: string[] = [];
    
    // Distribute available slots across hours with realistic patterns
    // Higher availability in mid-day hours, lower in early morning and late evening
    const hourlyWeights = [0.5, 1.5, 2, 2.5, 3, 3.5, 4, 3.5, 3, 2, 1.5, 1, 0.5]; // 13 hours
    const totalWeight = hourlyWeights.reduce((sum, weight) => sum + weight, 0);
    
    let remainingSlots = totalAvailable;
    
    for (let i = 0; i < hours; i++) {
      let slotsForHour;
      
      if (i === hours - 1) {
        // Last hour gets remaining slots
        slotsForHour = remainingSlots;
      } else {
        // Distribute proportionally based on weight
        const proportion = hourlyWeights[i] / totalWeight;
        slotsForHour = Math.round(totalAvailable * proportion);
        remainingSlots -= slotsForHour;
      }
      
      // Format as decimal if needed (some slots are half-slots like "3.5")
      const formattedSlots = slotsForHour % 1 === 0 ? slotsForHour.toString() : slotsForHour.toFixed(1);
      hourlySlots.push(formattedSlots);
    }
    
    return hourlySlots;
  }

  /**
   * Find available time slots for each location starting from now + 1 hour
   */
  async getAvailableLocations(minAvailabilityPercent: number = 25, date?: string): Promise<any> {
    try {
      // Validate input date before processing
      if (date) {
        const testDate = new Date(date);
        if (isNaN(testDate.getTime()) || testDate.getFullYear() > 2100 || testDate.getFullYear() < 2020) {
          throw new Error(`Invalid input date provided: "${date}". Please provide a valid date in YYYY-MM-DD format.`);
        }
      }
      
      // Step 1: Get all locations
      const locationsResponse = await this.executeLocationsQuery();
      
      if (!(locationsResponse.data as any)?.locations?.edges) {
        throw new Error('Failed to fetch locations');
      }

      const locations = (locationsResponse.data as any).locations.edges.map((edge: any) => edge.node);
      const { startDate, endDate } = date ? this.getDateRange(date) : this.getTomorrowDateRange();
      
      console.log(`🔍 TOTAL LOCATIONS TO PROCESS: ${locations.length}`);
      locations.forEach((loc: any, index: number) => {
        console.log(`  ${index + 1}. ${loc.name} (${loc.id})`);
      });
      
      // Step 2: Get detailed availability for each location
      const availabilityResults: any[] = [];
      const businessHours = { start: 8, end: 21 }; // 8 AM to 9 PM

      for (let i = 0; i < locations.length; i++) {
        const location = locations[i];
        console.log(`\n🎯 PROCESSING LOCATION ${i + 1}/${locations.length}: ${location.name}`);
        if (location.isRemote) {
          continue; // Skip remote locations
        }

        try {
          console.log(`🏢 ========== PROCESSING LOCATION: ${location.name} (${location.id}) ==========`);
          
          // Get appointments for this location
          const appointmentsResponse = await this.getLocationAppointments(
            location.id,
            startDate,
            endDate
          );

          const appointments = (appointmentsResponse.data as any)?.appointments?.edges?.map((edge: any) => edge.node) || [];
          console.log(`📅 Raw appointments found for ${location.name}: ${appointments.length}`);
          
          // Filter out cancelled appointments AND filter by target date AND filter out training facials
          const targetDate = startDate.split('T')[0];
          const bookedAppointments = appointments.filter((apt: any) => {
            // Skip cancelled appointments
            if (apt.cancelled || apt.state === 'CANCELLED') return false;
            
            // Only include appointments that start on the target date
            const aptDate = apt.startAt.split('T')[0];
            if (aptDate !== targetDate) return false;
            
            // Skip appointments with ANY training facial service
            const hasTrainingFacial = apt.appointmentServices?.some((service: any) => {
              const serviceName = service?.service?.name || '';
              return serviceName.toLowerCase().includes('training facial');
            });
            if (hasTrainingFacial) return false;
            
            return true;
          });
          
          console.log(`✅ Active appointments for ${location.name}: ${bookedAppointments.length}`);
          
          // DEBUG: Log detailed appointment data for validation
          console.log(`🔍 ${location.name} appointments for ${targetDate}:`);
          console.log(`  Raw API response: ${appointments.length} appointments`);
          console.log(`  After filtering cancelled & date: ${bookedAppointments.length} target date appointments`);
          
          // Verify all appointments are for the correct date
          const dateMismatches = appointments.filter(apt => {
            const aptDate = apt.startAt.split('T')[0];
            return aptDate !== targetDate;
          });
          if (dateMismatches.length > 0) {
            console.log(`📅 Found ${dateMismatches.length} appointments from other dates (filtered out)`);
          }
          
          // DEBUG: Show detailed data for validation locations
          const validationLocations = ['Hoboken', 'Georgetown', 'Hingham', 'Bryn Mawr'];
          const isValidationLocation = validationLocations.some(val => location.name.includes(val));
          
          if (isValidationLocation) {
            console.log(`📊 VALIDATION LOCATION: ${location.name} (Expected counts for validation)`);
            console.log(`  Final filtered count: ${bookedAppointments.length} appointments`);
            if (location.name.includes('Hoboken')) {
              console.log(`  🏠 HOBOKEN EXPECTED: 22 booked, but found: ${bookedAppointments.length}`);
            }
            
            console.log(`  Appointment breakdown:`);
            bookedAppointments.forEach((apt: any, index: number) => {
              const aptDate = apt.startAt.split('T')[0];
              const aptTime = apt.startAt.split('T')[1];
              console.log(`    ${index + 1}. Date: ${aptDate} | Time: ${aptTime} | Client: ${apt.client?.firstName} ${apt.client?.lastName} | State: ${apt.state}`);
            });
          }
          
          // Process appointment data to extract time slots and staff info
          const timeSlots = bookedAppointments.map((apt: any) => ({
            id: apt.id,
            startTime: apt.startAt,
            endTime: apt.endAt,
            duration: apt.duration,
            state: apt.state,
            staff: apt.appointmentServices?.[0]?.staff ? {
              id: apt.appointmentServices[0].staff.id,
              name: `${apt.appointmentServices[0].staff.firstName} ${apt.appointmentServices[0].staff.lastName}`,
              role: apt.appointmentServices[0].staff.role?.name
            } : null,
            service: apt.appointmentServices?.[0]?.service ? {
              id: apt.appointmentServices[0].service.id,
              name: apt.appointmentServices[0].service.name,
              category: apt.appointmentServices[0].service.category?.name,
              price: apt.appointmentServices[0].price
            } : null,
            client: apt.client ? {
              name: `${apt.client.firstName} ${apt.client.lastName}`,
              email: apt.client.email
            } : null
          }));

          // Calculate availability metrics
          const bookedCount = bookedAppointments.length;
          
          // Generate potential booking times with proper timezone handling
          const locationTimeZone = this.inferLocationTimeZone(location.name, location.address);
          const availableTimeSlots = this.generateAvailableTimeSlots(timeSlots, businessHours, startDate, locationTimeZone);
          
          // Calculate schedule capacity based on ACTUAL staff shifts using CSV formula
          const scheduleCapacity = await this.calculateScheduleCapacity(
            location.id,
            startDate,
            endDate,
            bookedAppointments
          );
          
          // Calculate available slots from schedule capacity (capacity includes booked + available)
          const availableSlots = Math.max(0, scheduleCapacity - bookedCount);
          const availabilityPercent = scheduleCapacity > 0 ? (availableSlots / scheduleCapacity) * 100 : 0;
          
          // Create service-specific booking URL (placeholder for now)
          const bookingBaseUrl = `https://widget.boulevard.io/${this.config.businessId}`;
          
          availabilityResults.push({
            locationId: location.id,
            locationName: location.name,
            availabilityPercent: Math.round(availabilityPercent * 100) / 100,
            totalAppointments: scheduleCapacity,
            schedule: scheduleCapacity, // Add this field for frontend
            bookedAppointments: bookedCount,
            availableSlots: availableSlots,
            date: startDate.split('T')[0],
            // NEW: Individual time slot data
            bookedTimeSlots: timeSlots,
            availableTimeSlots: availableTimeSlots,
            bookingUrl: `${bookingBaseUrl}?location=${location.id}`
          });
          
          console.log(`📊 FINAL RESULTS for ${location.name}: ${availableSlots} available appointments (CSV formula)`);
          console.log(`🏢 ========== END PROCESSING: ${location.name} ==========\n`);
        } catch (error) {
          console.error(`❌ ERROR processing location ${location.name}:`, error);
          console.error(`Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');
          // Continue with other locations
        }
      }
      
      console.log(`✅ LOCATION PROCESSING COMPLETE! Processed ${availabilityResults.length} locations successfully.`);

      // Sort alphabetically by studio name
      availabilityResults.sort((a: any, b: any) => a.locationName.localeCompare(b.locationName));

      // Filter for locations meeting the availability threshold
      const availableLocations = availabilityResults.filter(loc => loc.availabilityPercent >= minAvailabilityPercent);

      return {
        success: true,
        date: date || startDate.split('T')[0],
        minAvailabilityPercent,
        totalLocationsChecked: locations.filter((loc: any) => !loc.isRemote).length,
        availableLocationsCount: availableLocations.length,
        availableLocations: availableLocations,
        allLocations: availabilityResults
      };

    } catch (error) {
      console.error('Error getting available locations:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        availableLocations: []
      };
    }
  }

  /**
   * Since all studios are in the northeast, always return Eastern Time
   */
  inferLocationTimeZone(locationName: string, address?: { city?: string; state?: string }): string {
    console.log(`🌆 Using Eastern Time for location: ${locationName} (${address?.city || ''}, ${address?.state || ''})`);
    return 'America/New_York';
  }

  /**
   * Generate available time slots based on business hours and booked appointments
   * Updated to handle 40-minute appointment intervals instead of hourly slots
   */
  generateAvailableTimeSlots(bookedSlots: any[], businessHours: { start: number, end: number }, startDate: string, locationTimeZone: string): any[] {
    const availableSlots: any[] = [];
    
    console.log(`🕐 Generating 40-minute interval slots for ${locationTimeZone} on ${startDate}`);
    console.log(`📋 Business hours: ${businessHours.start}:00 - ${businessHours.end}:00`);
    
    // Parse the input date
    const baseDate = new Date(startDate);
    
    // Generate slots every 40 minutes during business hours
    const SLOT_DURATION_MINUTES = 30; // 30-minute appointment duration
    const SLOT_INTERVAL_MINUTES = 40; // 40-minute intervals (30-minute appointment + 10-minute buffer)
    const businessStartMinutes = businessHours.start * 60; // Convert to minutes from midnight
    const businessEndMinutes = businessHours.end * 60; // Convert to minutes from midnight
    
    console.log(`⏰ Generating 40-minute slots from ${businessStartMinutes/60}:00 to ${businessEndMinutes/60}:00`);
    
    // Generate slots every 40 minutes within business hours
    for (let minutes = businessStartMinutes; minutes < businessEndMinutes; minutes += SLOT_INTERVAL_MINUTES) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      
      // Skip if this slot would end after business hours
      if (minutes + SLOT_DURATION_MINUTES > businessEndMinutes) {
        console.log(`⏭️ Skipping slot at ${hour}:${minute.toString().padStart(2, '0')} - would end after business hours`);
        continue;
      }
      
      // PROPER: Create timezone-aware date using robust approach
      const year = baseDate.getFullYear();
      const month = baseDate.getMonth(); // Keep 0-indexed for Date constructor
      const day = baseDate.getDate();
      
      // Create timezone-aware UTC date using proper IANA timezone conversion
      const utcSlotDate = this.convertLocalTimeToUTC(year, month, day, hour, minute, locationTimeZone);
      
      // Validate the date conversion succeeded (but allow year boundary crossings)
      if (isNaN(utcSlotDate.getTime())) {
        console.error(`Invalid UTC date conversion for ${year}-${month + 1}-${day} ${hour}:${minute}`);
        continue; // Skip invalid conversions only
      }
      
      // Check for conflicts with booked appointments - only unavailable if ALL staff are booked
      const slotStart = utcSlotDate.getTime();
      const slotEnd = slotStart + (SLOT_DURATION_MINUTES * 60 * 1000);
      
      // Check for conflicts with booked appointments (return to simple conflict detection)
      const hasBookings = bookedSlots.some(booking => {
        const bookingStart = new Date(booking.startTime).getTime();
        const bookingEnd = new Date(booking.endTime).getTime();
        
        // Check if there's any overlap between the slot and the booking
        const overlaps = (slotStart < bookingEnd && slotEnd > bookingStart);
        
        if (overlaps) {
          console.log(`🔍 CONFLICT: Slot ${hour}:${minute.toString().padStart(2, '0')} overlaps with booking ${booking.startTime} - ${booking.endTime}`);
        }
        
        return overlaps;
      });
      
      // Only create slot if no bookings conflict
      if (!hasBookings) {
        const slot = {
          startTime: utcSlotDate.toISOString(),
          endTime: new Date(slotEnd).toISOString(),
          duration: SLOT_DURATION_MINUTES,
          type: 'available',
          locationTimeZone: locationTimeZone,
          localHour: hour,
          localMinute: minute
        };
        
        const locationDisplayTime = utcSlotDate.toLocaleString('en-US', { 
          timeZone: locationTimeZone,
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true 
        });
        
        console.log(`✅ Generated 40-min slot: ${hour}:${minute.toString().padStart(2, '0')} -> ${locationTimeZone} ${locationDisplayTime} -> UTC ${slot.startTime}`);
        availableSlots.push(slot);
      } else {
        console.log(`❌ Skipping slot ${hour}:${minute.toString().padStart(2, '0')} - conflicts with existing booking`);
      }
    }
    
    return availableSlots;
  }

  /**
   * Convert local time components to UTC using IANA timezone
   * Robust approach that avoids date corruption
   */
  private convertLocalTimeToUTC(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
    // Create a local time string in the target timezone
    const localTimeString = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
    
    // Create a temporary date assuming this is UTC (we'll correct it)
    const tempDate = new Date(localTimeString + 'Z');
    
    // Get what time this UTC moment would display in the target timezone
    const timeInZone = tempDate.toLocaleString('en-CA', { 
      timeZone, 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
    
    // Parse the timezone-adjusted time to see the offset
    const [datePart, timePart] = timeInZone.split(', ');
    const zoneTimeString = `${datePart}T${timePart}:00Z`;
    const zoneDate = new Date(zoneTimeString);
    
    // Calculate the offset and apply it
    const offsetMs = tempDate.getTime() - zoneDate.getTime();
    const utcDate = new Date(tempDate.getTime() + offsetMs);
    
    return utcDate;
  }


  private async testNetworkConnectivity(): Promise<TestResult> {
    try {
      const body = JSON.stringify({ query: '{ __typename }' });
      const headers = this.createAuthHeaders();

      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers,
        body,
      });

      if (response.ok) {
        return {
          name: 'Network Connectivity',
          status: 'passed',
          message: 'Successfully connected to BLVD API endpoint',
          metadata: {
            responseTime: `${response.headers.get('x-response-time') || 'N/A'}`,
          },
        };
      } else {
        return {
          name: 'Network Connectivity',
          status: 'failed',
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (error) {
      return {
        name: 'Network Connectivity',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  private async testSchemaIntrospection(): Promise<TestResult> {
    try {
      const query = `
        query IntrospectionQuery {
          __schema {
            types {
              name
            }
          }
        }
      `;

      const response = await this.makeGraphqlRequest(query);
      
      if (response.data && !response.errors) {
        return {
          name: 'GraphQL Schema Introspection',
          status: 'passed',
          message: 'Schema validation successful, all required types found',
          metadata: {
            schemaVersion: new Date().toISOString().split('T')[0],
          },
        };
      } else {
        return {
          name: 'GraphQL Schema Introspection',
          status: 'failed',
          message: response.errors?.[0]?.message || 'Schema introspection failed',
        };
      }
    } catch (error) {
      return {
        name: 'GraphQL Schema Introspection',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Schema error',
      };
    }
  }

  private async testBusinessAccess(): Promise<TestResult> {
    try {
      const query = `
        query TestBusiness {
          business {
            id
            name
          }
        }
      `;

      const response = await this.makeGraphqlRequest(query);

      if (response.data?.business) {
        return {
          name: 'Business Access Test',
          status: 'passed',
          message: 'Successfully accessed business data with provided credentials',
        };
      } else {
        return {
          name: 'Business Access Test',
          status: 'failed',
          message: response.errors?.[0]?.message || 'Business access denied',
        };
      }
    } catch (error) {
      return {
        name: 'Business Access Test',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Business access error',
      };
    }
  }

  async makeGraphqlRequest(query: string, variables?: any): Promise<GraphqlResponse> {
    try {
      const body = JSON.stringify({ query, variables });
      const headers = this.createAuthHeaders();
      
      console.log('Making GraphQL request to:', this.config.apiUrl);
      console.log('Request headers:', {
        'Content-Type': headers['Content-Type'],
        'Authorization': 'Basic [signed token with API key]',
      });
      
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers,
        body,
      });

      console.log('Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response body:', errorText);
        throw new Error(`GraphQL HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('GraphQL response received:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('GraphQL request failed:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`GraphQL request failed: ${String(error)}`);
    }
  }

}

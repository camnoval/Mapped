import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  try {
    console.log("Upload request received");

    // CORS headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };

    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers, body: "" };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: "No body provided" }),
      };
    }

    const body = JSON.parse(event.body);
    const { Username, Lat, Long, "Date Taken": DateTaken } = body;

    // Validate required fields
    if (!Username || !Lat || !Long || !DateTaken) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: "Missing required fields: Username, Lat, Long, Date Taken" 
        }),
      };
    }

    // Split newline-separated strings into arrays
    const latitudes = Lat.trim().split('\n').filter(v => v);
    const longitudes = Long.trim().split('\n').filter(v => v);
    const dateTaken = DateTaken.trim().split('\n').filter(v => v);

    // Validate all arrays have same length
    const count = latitudes.length;
    if (longitudes.length !== count || dateTaken.length !== count) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: `Mismatched data lengths: ${latitudes.length} lats, ${longitudes.length} longs, ${dateTaken.length} dates` 
        }),
      };
    }

    console.log(`Processing ${count} photos for user: ${Username}`);

    // Parse dates and prepare records
    const records = [];
    const errors = [];

    for (let i = 0; i < count; i++) {
      try {
        const lat = parseFloat(latitudes[i]);
        const lng = parseFloat(longitudes[i]);
        
        // Parse iOS date format: "Sep 30, 2025 at 7:21 PM"
        const dateStr = dateTaken[i];
        const date = new Date(dateStr);
        
        if (isNaN(lat) || isNaN(lng) || isNaN(date.getTime())) {
          errors.push({ 
            index: i, 
            error: `Invalid data - lat: ${latitudes[i]}, lng: ${longitudes[i]}, date: ${dateStr}` 
          });
          continue;
        }

        records.push({
          username: Username.toLowerCase(),
          latitude: lat,
          longitude: lng,
          date_taken: date.toISOString(),
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        errors.push({ index: i, error: err.message });
      }
    }

    if (records.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: "No valid records to insert",
          errors 
        }),
      };
    }

    // Batch insert into database
    const { data, error: insertError } = await supabase
      .from("user_photos")
      .insert(records)
      .select();

    if (insertError) {
      console.error("Database insert error:", insertError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: insertError.message 
        }),
      };
    }

    console.log(`Successfully inserted ${data.length} photos`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Successfully uploaded ${data.length} photos!`,
        processed: data.length,
        failed: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
    };
  } catch (err) {
    console.error("Upload handler error:", err);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
}
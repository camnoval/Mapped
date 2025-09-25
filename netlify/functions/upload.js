import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client (server-only keys)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  try {
    console.log("Raw event body:", event.body);

    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: "No body provided" }),
      };
    }

    const body = JSON.parse(event.body);

    // Expect raw newline-separated strings
    const { Username, Lat, Long, "Date Taken": DateTaken } = body;

    if (!Username || !Lat || !Long || !DateTaken) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: "Missing fields" }),
      };
    }

    // Insert raw data into Supabase
    const { data, error } = await supabase
      .from("user_photos_raw")
      .insert([
        {
          username: Username,
          lat: Lat,
          long: Long,
          date_taken: DateTaken,
        },
      ]);

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Received!", data }),
    };
  } catch (err) {
    console.error("Upload error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
}

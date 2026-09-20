"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function SupabaseTestPage() {
  const [status, setStatus] = useState("Connecting to Supabase...");

  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id")
        .limit(1);

      if (error) {
        setStatus(`Supabase response: ${error.message}`);
        console.error("Supabase test:", error);
        return;
      }

      setStatus(
        `Supabase connected successfully ✅ (${data?.length ?? 0} profiles found)`
      );
    }

    testConnection();
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "40px",
      }}
    >
      <div>
        <h1>Artha × Supabase</h1>
        <p>{status}</p>
      </div>
    </main>
  );
}
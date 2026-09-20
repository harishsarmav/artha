"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function SupabaseConnectionTest() {
  const [status, setStatus] = useState("Checking Supabase...");

  useEffect(() => {
    async function checkConnection() {
      const { error } = await supabase
        .from("profiles")
        .select("user_id")
        .limit(1);

      if (error) {
        setStatus(`Supabase error: ${error.message}`);
        return;
      }

      setStatus("Supabase connection successful ✅");
    }

    checkConnection();
  }, []);

  return (
    <div style={{ marginTop: 20 }}>
      <strong>{status}</strong>
    </div>
  );
}
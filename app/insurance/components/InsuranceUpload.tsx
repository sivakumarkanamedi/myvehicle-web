"use client";

import { useState } from "react";
import { supabase } from "../../../supabase";

interface Props {
  userId: string;
  onUploaded: (url: string) => void;
}

export default function InsuranceUpload({
  userId,
  onUploaded,
}: Props) {
  const [uploading, setUploading] = useState(false);

  async function uploadFile(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    setUploading(true);

    const fileName = `${userId}/${Date.now()}-${file.name}`;

    const { error } = await supabase.storage
      .from("insurance-documents")
      .upload(fileName, file);

    if (error) {
      alert(error.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage
      .from("insurance-documents")
      .getPublicUrl(fileName);

    onUploaded(data.publicUrl);

    setUploading(false);
  }

  return (
    <div>
      <label
        style={{
          display: "block",
          marginBottom: 10,
          fontWeight: 600,
        }}
      >
        Insurance Document
      </label>

      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={uploadFile}
      />

      {uploading && (
        <p style={{ marginTop: 10 }}>
          Uploading...
        </p>
      )}
    </div>
  );
}
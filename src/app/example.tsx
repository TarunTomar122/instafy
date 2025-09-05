'use client'

import { useRef, useState } from "react";
import { removeBackground } from "../utils/imageEdits";

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [bgRemoved, setBgRemoved] = useState<string | null>(null);
  const [geminiImage, setGeminiImage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processImage = async (img: string) => {
    setLoading(true);
    setBgRemoved(null);
    setGeminiImage(null);
    try {
      const result = await removeBackground(img);
      setBgRemoved(result);
      setLoading(false);
      // Now call Gemini API with the original uploaded image
      setGeminiLoading(true);
      // Extract base64 from data URL of the original image
      const base64 = img.split(",")[1];
      const resp = await fetch("/api/gemini-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Turn the background color to blue",
          imageBase64: base64,
        }),
      });
      const data = await resp.json();
      if (data.imageBase64) {
        setGeminiImage(`data:image/png;base64,${data.imageBase64}`);
      } else {
        setGeminiImage(null);
      }
    } catch (e) {
      setBgRemoved(null);
      setGeminiImage(null);
    }
    setLoading(false);
    setGeminiLoading(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = event.target?.result as string;
        setImage(img);
        processImage(img);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = event.target?.result as string;
        setImage(img);
        processImage(img);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "#fff",
      }}
    >
      {image ? (
        <div style={{ display: "flex", gap: 40 }}>
          {/* Original image */}
          <div
            style={{
              width: 300,
              height: 300,
              border: "2px solid #222",
              borderRadius: 32,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              background: "#fff",
              fontFamily: "Comic Sans MS, Comic Sans, cursive",
              fontSize: 20,
              textAlign: "center",
            }}
          >
            <img
              src={image}
              alt="uploaded image"
              style={{
                maxWidth: "90%",
                maxHeight: "90%",
                borderRadius: 24,
                objectFit: "contain",
              }}
            />
          </div>
          {/* BG removed image */}
          <div
            style={{
              width: 300,
              height: 300,
              border: "2px solid #222",
              borderRadius: 32,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              background: "#fff",
              fontFamily: "Comic Sans MS, Comic Sans, cursive",
              fontSize: 20,
              textAlign: "center",
            }}
          >
            {loading ? (
              <span>removing background...</span>
            ) : bgRemoved ? (
              <img
                src={bgRemoved}
                alt="bg removed"
                style={{
                  maxWidth: "90%",
                  maxHeight: "90%",
                  borderRadius: 24,
                  objectFit: "contain",
                }}
              />
            ) : (
              <span>uploaded image</span>
            )}
          </div>
          {/* Gemini-edited image */}
          <div
            style={{
              width: 300,
              height: 300,
              border: "2px solid #222",
              borderRadius: 32,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              background: "#fff",
              fontFamily: "Comic Sans MS, Comic Sans, cursive",
              fontSize: 20,
              textAlign: "center",
            }}
          >
            {geminiLoading ? (
              <span>Gemini working...</span>
            ) : geminiImage ? (
              <img
                src={geminiImage}
                alt="gemini edited"
                style={{
                  maxWidth: "90%",
                  maxHeight: "90%",
                  borderRadius: 24,
                  objectFit: "contain",
                }}
              />
            ) : (
              <span>gemini image</span>
            )}
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
          style={{
            width: 300,
            height: 300,
            border: "2px solid #222",
            borderRadius: 32,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: dragActive ? "#f0f0f0" : "#fff",
            cursor: "pointer",
            transition: "background 0.2s",
            fontFamily: "Comic Sans MS, Comic Sans, cursive",
            fontSize: 20,
            textAlign: "center",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleChange}
          />
          <span>
            upload an<br />image using<br />drag and drop
          </span>
        </div>
      )}
    </div>
  );
}

'use client'

import { useMemo, useRef, useState } from 'react';
import NextImage from 'next/image';
import descriptions from '@/poseData/description.json';
import { removeBackground } from '@/utils/imageEdits';

type Step =
  | 'idle'
  | 'bg_removing'
  | 'bg_removed'
  | 'gemini_submitting'
  | 'gemini_done'
  | 'bg_transfer_submitting'
  | 'bg_transfer_done'
  | 'error';

const POSES = [
  { id: 'pose1', src: '/pose1.png', label: 'Pose 1' },
  { id: 'pose2', src: '/pose2.jpg', label: 'Pose 2' },
  { id: 'pose3', src: '/pose3.jpg', label: 'Pose 3' },
  { id: 'pose4', src: '/pose4.jpeg', label: 'Pose 4' },
  { id: 'pose5', src: '/pose5.jpg', label: 'Pose 5' },
] as const;

export default function Page() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);
  const [uploadedBase64, setUploadedBase64] = useState<string | null>(null);
  const [poseId, setPoseId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [bgRemovedUrl, setBgRemovedUrl] = useState<string | null>(null);
  const [resultDataUrl, setResultDataUrl] = useState<string | null>(null);
  const [composedDataUrl, setComposedDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canInstafy = useMemo(
    () => Boolean(uploadedDataUrl && poseId && step !== 'gemini_submitting' && step !== 'bg_removing'),
    [uploadedDataUrl, poseId, step]
  );

  const onPickImage = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setUploadedDataUrl(dataUrl);
      setResultDataUrl(null);
      setComposedDataUrl(null);
      setBgRemovedUrl(null);
      // extract base64 for API usage
      const base64 = dataUrl.split(',')[1] || null;
      setUploadedBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = (src: string, filename: string) => {
    try {
      const link = document.createElement('a');
      link.href = src;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {}
  };

  const handleInstafy = async () => {
    if (!uploadedDataUrl || !uploadedBase64 || !poseId) return;
    setError(null);
    setResultDataUrl(null);

    try {
      setStep('bg_removing');
      const removedUrl = await removeBackground(uploadedDataUrl);
      setBgRemovedUrl(removedUrl);
      setStep('bg_removed');

      // fetch blob and convert to base64 for Gemini
      const blob = await fetch(removedUrl).then((r) => r.blob());
      const bgRemovedBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] || '');
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });

      const prompt = (descriptions as Record<string, string>)[poseId];
      setStep('gemini_submitting');

      const resp = await fetch('/api/gemini-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Convert the user image to have the pose from the sketch. Preserve the original subject, their expression, clothes, hair etc. Just change the pose. The new pose description is: ${prompt}\nPose Selected: ${poseId}`,
          imagesBase64: [bgRemovedBase64],
        }),
      });

      const json = (await resp.json()) as { imageBase64?: string; error?: string };
      if (!resp.ok || !json.imageBase64) {
        throw new Error(json.error || 'Failed to generate image');
      }

      const geminiDataUrl = `data:image/png;base64,${json.imageBase64}`;
      setResultDataUrl(geminiDataUrl);
      setStep('gemini_done');

      // Second pass: ask Gemini to place the subject from the instafied image onto
      // the background of the original uploaded image.
      setStep('bg_transfer_submitting');

      const transferPrompt =
        'Use the background from the second image (original user photo) and place the subject from the first image (white/plain background) onto it. Preserve the subject styling, align perspective and lighting naturally, avoid cropping, and output a single coherent composite.';

      const transferResp = await fetch('/api/gemini-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: transferPrompt,
          imagesBase64: [json.imageBase64, uploadedBase64],
        }),
      });

      const transferJson = (await transferResp.json()) as { imageBase64?: string; error?: string };
      if (!transferResp.ok || !transferJson.imageBase64) {
        throw new Error(transferJson.error || 'Failed to transfer background');
      }
      setComposedDataUrl(`data:image/png;base64,${transferJson.imageBase64}`);
      setStep('bg_transfer_done');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong';
      setError(message);
      setStep('error');
    }
  };

  return (
    <main className="min-h-screen w-full bg-[var(--background)] text-black px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight text-white">instafy 🍌</h1>
          <button
            className="rounded-full border border-neutral-300 text-white px-4 py-2 text-sm"
            onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
          >
            See result
          </button>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-2">
          {/* Upload card */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Upload image</h2>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
              />
              <button
                onClick={onPickImage}
                className="rounded-lg bg-black px-4 py-2 text-white hover:opacity-90"
              >
                Choose file
              </button>
            </div>
            <div className="mt-6 grid place-items-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6">
              {uploadedDataUrl ? (
                <NextImage
                  src={uploadedDataUrl}
                  alt="uploaded"
                  className="rounded-lg object-contain"
                  width={400}
                  height={300}
                />
              ) : (
                <p className="text-neutral-500">Upload an image to get started</p>
              )}
            </div>
          </div>

          {/* Poses */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-medium">Choose a pose</h2>
            <div className="mt-6 grid grid-cols-3 gap-4 md:grid-cols-5">
              {POSES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPoseId(p.id)}
                  className={
                    'relative overflow-hidden rounded-xl border transition ' +
                    (poseId === p.id
                      ? 'border-black ring-2 ring-black'
                      : 'border-neutral-200 hover:border-neutral-400')
                  }
                >
                  <div className="relative h-40 w-full bg-neutral-50">
                    <NextImage src={p.src} alt={p.label} fill className="object-contain" />
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6">
              <button
                disabled={!canInstafy}
                onClick={handleInstafy}
                className="rounded-xl bg-black px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                instafy
              </button>
            </div>

            {/* Progress */}
            <div className="mt-4 text-sm text-neutral-600">
              {step === 'idle' && <span>Waiting for image and pose…</span>}
              {step === 'bg_removing' && <span>Step 1/4: Removing background…</span>}
              {step === 'bg_removed' && <span>Step 2/4: Background removed.</span>}
              {step === 'gemini_submitting' && <span>Step 3/4: Generating instafied subject…</span>}
              {step === 'gemini_done' && <span>Step 3/4 complete.</span>}
              {step === 'bg_transfer_submitting' && <span>Step 4/4: Transferring original background…</span>}
              {step === 'bg_transfer_done' && <span>All steps complete!</span>}
              {step === 'error' && <span className="text-red-600">{error}</span>}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-10 md:grid-cols-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-neutral-700">Original</h3>
            <div className="group relative grid place-items-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4">
              {uploadedDataUrl ? (
                <>
                  <NextImage src={uploadedDataUrl} alt="original" width={400} height={300} className="rounded-md object-contain" />
                  <button
                    onClick={() => handleDownload(uploadedDataUrl, 'original.png')}
                    className="absolute right-3 top-3 hidden rounded-md bg-black/70 px-2 py-1 text-xs text-white group-hover:block"
                    aria-label="Download original"
                  >
                    Download
                  </button>
                </>
              ) : (
                <span className="text-neutral-500">—</span>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-neutral-700">Background removed</h3>
            <div className="group relative grid place-items-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4">
              {bgRemovedUrl ? (
                <>
                  <NextImage src={bgRemovedUrl} alt="bg removed" width={400} height={300} className="rounded-md object-contain" />
                  <button
                    onClick={() => handleDownload(bgRemovedUrl, 'background-removed.png')}
                    className="absolute right-3 top-3 hidden rounded-md bg-black/70 px-2 py-1 text-xs text-white group-hover:block"
                    aria-label="Download background removed"
                  >
                    Download
                  </button>
                </>
              ) : (
                <span className="text-neutral-500">—</span>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-neutral-700">Instafied</h3>
            <div className="group relative grid place-items-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4">
              {resultDataUrl ? (
                <>
                  <NextImage src={resultDataUrl} alt="result" width={400} height={300} className="rounded-md object-contain" />
                  <button
                    onClick={() => handleDownload(resultDataUrl, 'instafied.png')}
                    className="absolute right-3 top-3 hidden rounded-md bg-black/70 px-2 py-1 text-xs text-white group-hover:block"
                    aria-label="Download instafied"
                  >
                    Download
                  </button>
                </>
              ) : (
                <span className="text-neutral-500">—</span>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-neutral-700">Instafied over original background</h3>
            <div className="group relative grid place-items-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4">
              {composedDataUrl ? (
                <>
                  <NextImage src={composedDataUrl} alt="composed" width={400} height={300} className="rounded-md object-contain" />
                  <button
                    onClick={() => handleDownload(composedDataUrl, 'instafied-over-background.png')}
                    className="absolute right-3 top-3 hidden rounded-md bg-black/70 px-2 py-1 text-xs text-white group-hover:block"
                    aria-label="Download composed"
                  >
                    Download
                  </button>
                </>
              ) : (
                <span className="text-neutral-500">—</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}


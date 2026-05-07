"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { createClient } from "@/lib/supabase/client";

type Props = {
	pathPrefix: string;
	value: string | null;
	name?: string | null;
	kind?: "player" | "team";
	onChange: (url: string | null) => void | Promise<void>;
	label?: string;
	helpText?: string;
	size?: number;
	disabled?: boolean;
};

const OUTPUT_SIZE = 512;
const WEBP_QUALITY = 0.86;
const MAX_INPUT_PIXELS = 30_000_000;

async function readJpegOrientation(file: File): Promise<number> {
	if (!/^image\/jpe?g$/i.test(file.type)) return 1;
	try {
		const buf = await file.slice(0, 128 * 1024).arrayBuffer();
		const view = new DataView(buf);
		if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1;
		let offset = 2;
		while (offset + 4 < view.byteLength) {
			const marker = view.getUint16(offset);
			if ((marker & 0xff00) !== 0xff00) return 1;
			const size = view.getUint16(offset + 2);
			if (marker === 0xffe1 && offset + 10 < view.byteLength) {
				if (view.getUint32(offset + 4) === 0x45786966) {
					const tiff = offset + 10;
					const little = view.getUint16(tiff) === 0x4949;
					const ifdOffset = view.getUint32(tiff + 4, little);
					const ifd = tiff + ifdOffset;
					if (ifd + 2 > view.byteLength) return 1;
					const num = view.getUint16(ifd, little);
					for (let i = 0; i < num; i++) {
						const entry = ifd + 2 + i * 12;
						if (entry + 12 > view.byteLength) break;
						if (view.getUint16(entry, little) === 0x0112) {
							return view.getUint16(entry + 8, little) || 1;
						}
					}
					return 1;
				}
			}
			offset += 2 + size;
		}
	} catch {
		return 1;
	}
	return 1;
}

function applyOrientation(
	ctx: CanvasRenderingContext2D,
	orientation: number,
	w: number,
	h: number,
) {
	switch (orientation) {
		case 2:
			ctx.transform(-1, 0, 0, 1, w, 0);
			break;
		case 3:
			ctx.transform(-1, 0, 0, -1, w, h);
			break;
		case 4:
			ctx.transform(1, 0, 0, -1, 0, h);
			break;
		case 5:
			ctx.transform(0, 1, 1, 0, 0, 0);
			break;
		case 6:
			ctx.transform(0, 1, -1, 0, h, 0);
			break;
		case 7:
			ctx.transform(0, -1, -1, 0, h, w);
			break;
		case 8:
			ctx.transform(0, -1, 1, 0, 0, w);
			break;
		default:
			break;
	}
}

async function normalizeImage(file: File): Promise<string> {
	const orientation = await readJpegOrientation(file);
	const bitmap = await createImageBitmap(file, { imageOrientation: "none" });
	try {
		const w = bitmap.width;
		const h = bitmap.height;
		if (w * h > MAX_INPUT_PIXELS) {
			throw new Error("Bildet er for stort (over 30 megapiksler).");
		}
		const swap = orientation >= 5 && orientation <= 8;
		const canvas = document.createElement("canvas");
		canvas.width = swap ? h : w;
		canvas.height = swap ? w : h;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Canvas ikke tilgjengelig.");
		applyOrientation(ctx, orientation, w, h);
		ctx.drawImage(bitmap, 0, 0);
		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, "image/jpeg", 0.95),
		);
		if (!blob) throw new Error("Kunne ikke kode bildet.");
		return URL.createObjectURL(blob);
	} finally {
		bitmap.close();
	}
}

function makeNonce() {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID().replace(/-/g, "");
	}
	return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function AvatarUploader({
	pathPrefix,
	value,
	name,
	kind = "player",
	onChange,
	label = "Bilde",
	helpText,
	size = 80,
	disabled,
}: Props) {
	const fileInput = useRef<HTMLInputElement | null>(null);
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState<string | null>(null);
	const [editing, setEditing] = useState<{ src: string; file: File } | null>(
		null,
	);

	function openPicker() {
		setErr(null);
		fileInput.current?.click();
	}

	async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		if (!file.type.startsWith("image/")) {
			setErr("Filen må være et bilde.");
			return;
		}
		setBusy(true);
		try {
			const url = await normalizeImage(file);
			setEditing({ src: url, file });
		} catch (err) {
			setErr(err instanceof Error ? err.message : "Kunne ikke lese bildet.");
		} finally {
			setBusy(false);
		}
	}

	async function onCropConfirm(blob: Blob) {
		setEditing(null);
		setBusy(true);
		setErr(null);
		try {
			const supabase = createClient();
			const cleanPrefix = pathPrefix.replace(/\/+$/, "");
			const path = `${cleanPrefix}/${makeNonce()}.webp`;
			const { error: upErr } = await supabase.storage
				.from("avatars")
				.upload(path, blob, {
					contentType: "image/webp",
					cacheControl: "31536000",
					upsert: false,
				});
			if (upErr) throw new Error(upErr.message);
			const { data } = supabase.storage.from("avatars").getPublicUrl(path);
			await onChange(data.publicUrl);
		} catch (e) {
			setErr(e instanceof Error ? e.message : "Kunne ikke laste opp bildet.");
		} finally {
			setBusy(false);
		}
	}

	async function onRemove() {
		setBusy(true);
		setErr(null);
		try {
			await onChange(null);
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="flex items-center gap-4">
			<button
				type="button"
				onClick={openPicker}
				disabled={disabled || busy}
				className="relative shrink-0 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-mustard)]"
				aria-label={value ? "Bytt bilde" : "Last opp bilde"}
			>
				<Avatar src={value} name={name} kind={kind} size={size} />
				<span
					aria-hidden
					className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-mustard)] text-sm shadow-[2px_2px_0_var(--color-ink)]"
				>
					{busy ? "…" : "📷"}
				</span>
			</button>
			<div className="min-w-0">
				<p className="text-xs font-extrabold uppercase tracking-widest text-[var(--color-ink)]/60">
					{label}
				</p>
				<div className="mt-1 flex flex-wrap items-center gap-2">
					<button
						type="button"
						onClick={openPicker}
						disabled={disabled || busy}
						className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] px-3 py-1.5 text-xs font-bold disabled:opacity-50"
					>
						{value ? "Bytt bilde" : "Last opp"}
					</button>
					{value && (
						<button
							type="button"
							onClick={onRemove}
							disabled={disabled || busy}
							className="rounded-full border-2 border-[var(--color-ink)]/40 bg-transparent px-3 py-1.5 text-xs font-bold text-[var(--color-ink)]/70 disabled:opacity-50"
						>
							Fjern
						</button>
					)}
				</div>
				{helpText && !err && (
					<p className="mt-1 text-xs text-[var(--color-ink)]/60">{helpText}</p>
				)}
				{err && (
					<p className="mt-1 text-xs font-bold text-[var(--color-terracotta-dark)]">
						{err}
					</p>
				)}
			</div>
			<input
				ref={fileInput}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={onPick}
			/>
			{editing && (
				<CropModal
					src={editing.src}
					onCancel={() => {
						URL.revokeObjectURL(editing.src);
						setEditing(null);
					}}
					onConfirm={async (blob) => {
						URL.revokeObjectURL(editing.src);
						await onCropConfirm(blob);
					}}
					onError={(msg) => {
						URL.revokeObjectURL(editing.src);
						setEditing(null);
						setErr(msg);
					}}
				/>
			)}
		</div>
	);
}

type CropModalProps = {
	src: string;
	onCancel: () => void;
	onConfirm: (blob: Blob) => void | Promise<void>;
	onError: (msg: string) => void;
};

function CropModal({ src, onCancel, onConfirm, onError }: CropModalProps) {
	const stageRef = useRef<HTMLDivElement | null>(null);
	const imgRef = useRef<HTMLImageElement | null>(null);
	const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [stageSize, setStageSize] = useState(280);
	const [scale, setScale] = useState(1);
	const [minScale, setMinScale] = useState(1);
	const [offset, setOffset] = useState({ x: 0, y: 0 });
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		const img = new Image();
		img.onload = () => setImgEl(img);
		img.onerror = () => onError("Kunne ikke lese bildet.");
		img.src = src;
	}, [src, onError]);

	useEffect(() => {
		const el = stageRef.current;
		if (!el) return;
		const ro = new ResizeObserver(() => {
			setStageSize(el.clientWidth);
		});
		ro.observe(el);
		setStageSize(el.clientWidth);
		return () => ro.disconnect();
	}, []);

	useEffect(() => {
		if (!imgEl || stageSize === 0) return;
		if (imgEl.naturalWidth * imgEl.naturalHeight > MAX_INPUT_PIXELS) {
			onError("Bildet er for stort (over 30 megapiksler).");
			return;
		}
		const fit = Math.max(
			stageSize / imgEl.naturalWidth,
			stageSize / imgEl.naturalHeight,
		);
		setMinScale(fit);
		setScale(fit);
		setOffset({ x: 0, y: 0 });
		setLoaded(true);
	}, [imgEl, stageSize, onError]);

	const clampOffset = useCallback(
		(o: { x: number; y: number }, sc: number) => {
			if (!imgEl) return o;
			const dispW = imgEl.naturalWidth * sc;
			const dispH = imgEl.naturalHeight * sc;
			const maxX = Math.max(0, (dispW - stageSize) / 2);
			const maxY = Math.max(0, (dispH - stageSize) / 2);
			return {
				x: Math.max(-maxX, Math.min(maxX, o.x)),
				y: Math.max(-maxY, Math.min(maxY, o.y)),
			};
		},
		[imgEl, stageSize],
	);

	useEffect(() => {
		setOffset((o) => clampOffset(o, scale));
	}, [scale, clampOffset]);

	const pointerState = useRef<{
		pointers: Map<number, { x: number; y: number }>;
		startOffset: { x: number; y: number };
		startScale: number;
		startDistance: number;
		startMid: { x: number; y: number };
	}>({
		pointers: new Map(),
		startOffset: { x: 0, y: 0 },
		startScale: 1,
		startDistance: 0,
		startMid: { x: 0, y: 0 },
	});

	function onPointerDown(e: React.PointerEvent) {
		(e.target as Element).setPointerCapture?.(e.pointerId);
		const ps = pointerState.current;
		ps.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (ps.pointers.size === 1) {
			ps.startOffset = offset;
		} else if (ps.pointers.size === 2) {
			const pts = [...ps.pointers.values()];
			const dx = pts[0].x - pts[1].x;
			const dy = pts[0].y - pts[1].y;
			ps.startDistance = Math.hypot(dx, dy) || 1;
			ps.startScale = scale;
			ps.startMid = {
				x: (pts[0].x + pts[1].x) / 2,
				y: (pts[0].y + pts[1].y) / 2,
			};
			ps.startOffset = offset;
		}
	}

	function onPointerMove(e: React.PointerEvent) {
		const ps = pointerState.current;
		if (!ps.pointers.has(e.pointerId)) return;
		const prev = ps.pointers.get(e.pointerId);
		ps.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (ps.pointers.size === 1) {
			if (!prev) return;
			const dx = e.clientX - prev.x;
			const dy = e.clientY - prev.y;
			setOffset((o) => clampOffset({ x: o.x + dx, y: o.y + dy }, scale));
		} else if (ps.pointers.size === 2) {
			const pts = [...ps.pointers.values()];
			const dx = pts[0].x - pts[1].x;
			const dy = pts[0].y - pts[1].y;
			const dist = Math.hypot(dx, dy) || 1;
			const ratio = dist / (ps.startDistance || 1);
			const next = Math.max(
				minScale,
				Math.min(minScale * 8, ps.startScale * ratio),
			);
			setScale(next);
		}
	}

	function onPointerUp(e: React.PointerEvent) {
		const ps = pointerState.current;
		ps.pointers.delete(e.pointerId);
		if (ps.pointers.size === 1) {
			ps.startOffset = offset;
		}
	}

	function onWheel(e: React.WheelEvent) {
		e.preventDefault();
		const factor = Math.exp(-e.deltaY * 0.0015);
		setScale((s) => Math.max(minScale, Math.min(minScale * 8, s * factor)));
	}

	async function onConfirmClick() {
		if (!imgEl || busy) return;
		setBusy(true);
		try {
			const canvas = document.createElement("canvas");
			canvas.width = OUTPUT_SIZE;
			canvas.height = OUTPUT_SIZE;
			const ctx = canvas.getContext("2d");
			if (!ctx) throw new Error("Canvas ikke tilgjengelig.");
			const cropPx = stageSize / scale;
			const sx = imgEl.naturalWidth / 2 - offset.x / scale - cropPx / 2;
			const sy = imgEl.naturalHeight / 2 - offset.y / scale - cropPx / 2;
			ctx.drawImage(
				imgEl,
				sx,
				sy,
				cropPx,
				cropPx,
				0,
				0,
				OUTPUT_SIZE,
				OUTPUT_SIZE,
			);
			const blob: Blob | null = await new Promise((resolve) =>
				canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
			);
			if (!blob) throw new Error("Kunne ikke kode bildet som webp.");
			await onConfirm(blob);
		} catch (err) {
			onError(err instanceof Error ? err.message : "Kunne ikke beskjære.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div
			className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--color-ink)]/70 px-4 py-6 backdrop-blur-sm"
			role="dialog"
			aria-modal="true"
			aria-label="Beskjær bilde"
		>
			<div className="card w-full max-w-md p-4 sm:p-5">
				<div className="flex items-baseline justify-between gap-3">
					<h2
						className="text-lg sm:text-xl"
						style={{ fontFamily: "var(--font-display)" }}
					>
						Beskjær bildet
					</h2>
					<button
						type="button"
						onClick={onCancel}
						className="text-sm font-bold opacity-70 hover:opacity-100"
					>
						Avbryt
					</button>
				</div>
				<p className="mt-1 text-xs text-[var(--color-ink)]/65">
					Dra for å flytte. Klyp eller bruk hjulet for å zoome.
				</p>
				<div
					ref={stageRef}
					className="relative mt-3 aspect-square w-full select-none overflow-hidden rounded-2xl border-2 border-[var(--color-ink)] bg-[var(--color-ink)]"
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={onPointerUp}
					onPointerCancel={onPointerUp}
					onWheel={onWheel}
					style={{ touchAction: "none" }}
				>
					{imgEl && loaded && (
						// biome-ignore lint/performance/noImgElement: local object URL
						<img
							ref={imgRef}
							src={src}
							alt=""
							draggable={false}
							style={{
								position: "absolute",
								left: "50%",
								top: "50%",
								width: imgEl.naturalWidth,
								height: imgEl.naturalHeight,
								maxWidth: "none",
								maxHeight: "none",
								transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
								transformOrigin: "center center",
								userSelect: "none",
								pointerEvents: "none",
								willChange: "transform",
							}}
						/>
					)}
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 rounded-2xl"
						style={{
							boxShadow: "0 0 0 9999px rgba(26,20,16,0.55) inset",
							borderRadius: "9999px",
						}}
					/>
				</div>
				<div className="mt-3 flex items-center gap-2">
					<span aria-hidden className="text-base">
						🔍
					</span>
					<input
						type="range"
						min={minScale}
						max={minScale * 8}
						step={(minScale * 7) / 100 || 0.01}
						value={scale}
						onChange={(e) => setScale(Number.parseFloat(e.target.value))}
						className="flex-1 accent-[var(--color-terracotta)]"
						aria-label="Zoom"
					/>
				</div>
				<div className="mt-4 flex flex-col gap-2 sm:flex-row">
					<button
						type="button"
						onClick={onCancel}
						className="btn btn-secondary flex-1"
					>
						Avbryt
					</button>
					<button
						type="button"
						onClick={onConfirmClick}
						disabled={busy || !loaded}
						className="btn btn-primary flex-1 disabled:opacity-50"
					>
						{busy ? "Lagrer…" : "Bruk bilde"}
					</button>
				</div>
			</div>
		</div>
	);
}

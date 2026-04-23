import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HiXMark } from 'react-icons/hi2';

const CROP_SIZE = 320;
const OUTPUT_SIZE = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const AvatarCropModal = ({ isOpen, imageUrl, fileName, processing, onClose, onConfirm }) => {
    const imageRef = useRef(null);
    const dragStateRef = useRef(null);

    const [imageRect, setImageRect] = useState({ width: 0, height: 0, baseScale: 1 });
    const [zoom, setZoom] = useState(MIN_ZOOM);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [error, setError] = useState('');

    const displaySize = useMemo(() => {
        if (!imageRect.width || !imageRect.height) {
            return { width: 0, height: 0, scale: 1 };
        }

        const scale = imageRect.baseScale * zoom;

        return {
            width: imageRect.width * scale,
            height: imageRect.height * scale,
            scale
        };
    }, [imageRect, zoom]);

    const clampPosition = (nextPosition, nextZoom = zoom) => {
        if (!imageRect.width || !imageRect.height) {
            return { x: 0, y: 0 };
        }

        const scaledWidth = imageRect.width * imageRect.baseScale * nextZoom;
        const scaledHeight = imageRect.height * imageRect.baseScale * nextZoom;
        const maxX = Math.max(0, (scaledWidth - CROP_SIZE) / 2);
        const maxY = Math.max(0, (scaledHeight - CROP_SIZE) / 2);

        return {
            x: clamp(nextPosition.x, -maxX, maxX),
            y: clamp(nextPosition.y, -maxY, maxY)
        };
    };

    const resetCrop = () => {
        setZoom(MIN_ZOOM);
        setPosition({ x: 0, y: 0 });
        setError('');
    };

    const handleImageLoad = (event) => {
        const { naturalWidth, naturalHeight } = event.currentTarget;
        const baseScale = Math.max(CROP_SIZE / naturalWidth, CROP_SIZE / naturalHeight);

        setImageRect({
            width: naturalWidth,
            height: naturalHeight,
            baseScale
        });
        resetCrop();
    };

    const handlePointerDown = (event) => {
        if (processing || !displaySize.width || !displaySize.height) return;

        dragStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            origin: position
        };

        event.currentTarget.setPointerCapture?.(event.pointerId);
    };

    const handlePointerMove = (event) => {
        const dragState = dragStateRef.current;

        if (!dragState || dragState.pointerId !== event.pointerId) return;

        const deltaX = event.clientX - dragState.startX;
        const deltaY = event.clientY - dragState.startY;

        setPosition(clampPosition({
            x: dragState.origin.x + deltaX,
            y: dragState.origin.y + deltaY
        }));
    };

    const handlePointerUp = (event) => {
        if (dragStateRef.current?.pointerId === event.pointerId) {
            dragStateRef.current = null;
        }
    };

    const handleZoomChange = (event) => {
        const nextZoom = Number(event.target.value);
        setZoom(nextZoom);
        setPosition((current) => clampPosition(current, nextZoom));
    };

    const handleConfirm = async () => {
        if (!imageRef.current || !imageRect.width || !imageRect.height) {
            setError('Не удалось подготовить изображение для обрезки.');
            return;
        }

        const scale = displaySize.scale;
        const imageLeft = (CROP_SIZE - displaySize.width) / 2 + position.x;
        const imageTop = (CROP_SIZE - displaySize.height) / 2 + position.y;
        const sourceSize = CROP_SIZE / scale;
        const sourceX = clamp((0 - imageLeft) / scale, 0, Math.max(0, imageRect.width - sourceSize));
        const sourceY = clamp((0 - imageTop) / scale, 0, Math.max(0, imageRect.height - sourceSize));

        const canvas = document.createElement('canvas');
        canvas.width = OUTPUT_SIZE;
        canvas.height = OUTPUT_SIZE;

        const context = canvas.getContext('2d');

        if (!context) {
            setError('Не удалось обработать изображение.');
            return;
        }

        context.fillStyle = '#111111';
        context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(
            imageRef.current,
            sourceX,
            sourceY,
            sourceSize,
            sourceSize,
            0,
            0,
            OUTPUT_SIZE,
            OUTPUT_SIZE
        );

        const blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/jpeg', 0.92);
        });

        if (!blob) {
            setError('Не удалось сохранить обрезанное изображение.');
            return;
        }

        const baseName = fileName?.replace(/\.[^.]+$/, '') || 'avatar';
        const croppedFile = new File([blob], `${baseName}-avatar.jpg`, { type: 'image/jpeg' });

        setError('');
        await onConfirm(croppedFile);
    };

    if (!isOpen || !imageUrl) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ scale: 0.96, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.96, opacity: 0 }}
                    className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#171719] p-6 shadow-2xl"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="mb-6 flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-white">Обрезать аватар</h2>
                            <p className="mt-2 text-sm text-gray-400">
                                Перетащите изображение и настройте масштаб. На сервер уйдет квадратный файл 512x512,
                                который будет показываться как круглая аватарка.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={processing}
                            className="text-gray-400 transition hover:text-white disabled:opacity-50"
                        >
                            <HiXMark className="h-6 w-6" />
                        </button>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
                        <div className="mx-auto">
                            <div
                                className="relative h-[320px] w-[320px] touch-none select-none overflow-hidden rounded-[32px] bg-black/40"
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerCancel={handlePointerUp}
                                onPointerLeave={handlePointerUp}
                            >
                                <img
                                    ref={imageRef}
                                    src={imageUrl}
                                    alt="Crop source"
                                    onLoad={handleImageLoad}
                                    draggable={false}
                                    className="absolute left-1/2 top-1/2 max-w-none"
                                    style={{
                                        width: `${displaySize.width}px`,
                                        height: `${displaySize.height}px`,
                                        transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`
                                    }}
                                />

                                <div className="pointer-events-none absolute inset-0 rounded-[32px] ring-1 ring-white/10" />
                                <div className="pointer-events-none absolute inset-5 rounded-full border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.48)]" />
                            </div>
                        </div>

                        <div className="flex flex-col justify-between gap-6">
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-gray-300">Масштаб</label>
                                <input
                                    type="range"
                                    min={MIN_ZOOM}
                                    max={MAX_ZOOM}
                                    step="0.01"
                                    value={zoom}
                                    onChange={handleZoomChange}
                                    className="w-full accent-purple-500"
                                />
                                <div className="mt-2 flex justify-between text-xs text-gray-500">
                                    <span>Меньше</span>
                                    <span>{Math.round(zoom * 100)}%</span>
                                    <span>Больше</span>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-400">
                                <p>Поддерживаются JPG, PNG и WEBP.</p>
                                <p className="mt-1">После выбора можно обрезать изображение под круглую аватарку.</p>
                                <p className="mt-1">Максимальный размер итогового файла: 3 МБ.</p>
                            </div>

                            {error && <p className="text-sm text-red-400">{error}</p>}

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={processing}
                                    className="flex-1 rounded-xl bg-purple-600 py-3 font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
                                >
                                    {processing ? 'Загрузка...' : 'Сохранить аватар'}
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={processing}
                                    className="flex-1 rounded-xl bg-white/10 py-3 font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
                                >
                                    Отмена
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AvatarCropModal;

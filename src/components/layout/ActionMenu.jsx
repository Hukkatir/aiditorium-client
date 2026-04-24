import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HiEllipsisHorizontal } from 'react-icons/hi2';

const ActionMenu = ({
    items,
    buttonClassName = '',
    menuClassName = '',
    label = 'Действия',
    showLabel = false,
    buttonLabel = 'Действия'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    const visibleItems = useMemo(
        () => items.filter((item) => !item.hidden),
        [items]
    );

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    if (!visibleItems.length) {
        return null;
    }

    return (
        <div
            ref={containerRef}
            className="relative shrink-0"
            onClick={(event) => event.stopPropagation()}
        >
            <button
                type="button"
                aria-label={label}
                onClick={() => setIsOpen((previous) => !previous)}
                className={`inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white ${buttonClassName}`.trim()}
            >
                <HiEllipsisHorizontal className="h-5 w-5" />
                {showLabel && <span>{buttonLabel}</span>}
            </button>

            {isOpen && (
                <div className={`absolute right-0 top-full z-20 mt-2 min-w-[180px] overflow-hidden rounded-xl border border-white/10 bg-[#1A1A1C] p-1 shadow-2xl ${menuClassName}`.trim()}>
                    {visibleItems.map((item) => {
                        const Icon = item.icon;

                        return (
                            <button
                                key={item.label}
                                type="button"
                                disabled={item.disabled}
                                onClick={() => {
                                    if (item.disabled) {
                                        return;
                                    }

                                    setIsOpen(false);
                                    item.onClick();
                                }}
                                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                                    item.disabled
                                        ? 'cursor-not-allowed opacity-50'
                                        : item.danger
                                            ? 'text-red-300 hover:bg-red-500/10'
                                            : 'text-gray-200 hover:bg-white/5'
                                }`}
                            >
                                {Icon && <Icon className="h-4 w-4" />}
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ActionMenu;

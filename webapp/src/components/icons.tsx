interface IconProps {
  className?: string;
}

const stroke = {
  fill: "none" as const,
  viewBox: "0 0 24 24",
  stroke: "currentColor" as const,
};

export const RefreshIcon = ({ className }: IconProps) => (
  <svg className={className} {...stroke}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

export const PlusIcon = ({ className }: IconProps) => (
  <svg className={className} {...stroke}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      d="M12 4v16m8-8H4"
    />
  </svg>
);

export const CloseIcon = ({ className }: IconProps) => (
  <svg className={className} {...stroke}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

export const CheckIcon = ({ className }: IconProps) => (
  <svg className={className} {...stroke}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={3}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

export const DownloadIcon = ({ className }: IconProps) => (
  <svg className={className} {...stroke}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
    />
  </svg>
);

export const OfflineIcon = ({ className }: IconProps) => (
  <svg className={className} {...stroke}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M8.464 15.536a5 5 0 010-7.072M5.636 18.364a9 9 0 010-12.728"
    />
  </svg>
);

export const PlayIcon = ({ className }: IconProps) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z" />
  </svg>
);

export const BackIcon = ({ className }: IconProps) => (
  <svg className={className} {...stroke}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      d="M15 19l-7-7 7-7"
    />
  </svg>
);

export const UploadsIcon = ({ className }: IconProps) => (
  <svg className={className} {...stroke}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5"
    />
  </svg>
);

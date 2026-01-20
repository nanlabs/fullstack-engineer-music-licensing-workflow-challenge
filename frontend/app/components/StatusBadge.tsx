'use client';

import { LicensingStatus } from '../types';

interface StatusBadgeProps {
  status: LicensingStatus | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusStyles = () => {
    switch (status) {
      case LicensingStatus.LICENSED:
      case 'LICENSED':
        return 'bg-green-100 text-green-700';
      case LicensingStatus.IN_NEGOTIATION:
      case 'IN_NEGOTIATION':
        return 'bg-yellow-100 text-yellow-700';
      case LicensingStatus.UNLICENSED:
      case 'UNLICENSED':
      default:
        return 'bg-red-100 text-red-700';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case LicensingStatus.LICENSED:
      case 'LICENSED':
        return 'Licensed';
      case LicensingStatus.IN_NEGOTIATION:
      case 'IN_NEGOTIATION':
        return 'In Negotiation';
      case LicensingStatus.UNLICENSED:
      case 'UNLICENSED':
      default:
        return 'Unlicensed';
    }
  };

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusStyles()}`}
    >
      {getStatusLabel()}
    </span>
  );
}

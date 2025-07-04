export interface GraduationReadyEvent {
  metadata_addr: string;
  token_amount: number;
  apt_amount: number;
  timestamp: number;
  token_metadata?: string;
}

export interface GraduationAttempt {
  metadata_addr: string;
  token_amount: number;
  apt_amount: number;
  attempts: number;
  last_attempt: number;
  max_attempts: number;
  retry_interval: number;
  status: 'pending' | 'success' | 'failed';
}

export interface PositionInfo {
  positionId: string;
  lpTokenAmount: number;
} 
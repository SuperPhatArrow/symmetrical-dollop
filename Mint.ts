export type Mint = {
    id: number;
    url: string;
    info: string;
    name: string;
    balance: number;
    sum_donations: number;
    updated_at: string;
    next_update: string;
    state: "OK" | "UNKNOWN" | "ERROR";
    n_errors: number;
    n_mints: number;
    n_melts: number;
  };
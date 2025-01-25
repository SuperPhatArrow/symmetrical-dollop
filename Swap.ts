export type Swap = {
  "id": number;
  "from_id": number;
  "to_id": number;
  "from_url": string;
  "to_url": string;
  "amount": number;
  "fee": number;
  "created_at": string;
  "time_taken": number;
  "state": "OK" | "UNKNOWN" | "ERROR";
  "error": null | string;
};

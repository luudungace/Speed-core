export interface EmailRow {
  id: string;
  created_at: string;
  updated_at: string;
  email: string;
  password: string;
  imap_host: string;
  imap_port: number;
  status: "available" | "locked" | "used";
  locked_at: string | null;
}

export interface ProxyRow {
  id: string;
  created_at: string;
  updated_at: string;
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  type: "Residential" | "Datacenter";
  status: "available" | "locked" | "dead";
  locked_at: string | null;
}

export interface PersonaRow {
  id: string;
  created_at: string;
  updated_at: string;
  display_name: string;
  username_base: string;
  bio: string | null;
  gender: string | null;
  country: string | null;
}

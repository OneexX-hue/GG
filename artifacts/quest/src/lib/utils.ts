import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getClientId() {
  let id = localStorage.getItem("quest_client_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("quest_client_id", id);
  }
  return id;
}

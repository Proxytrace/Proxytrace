import { useContext } from "react";
import LocalAuthContext from "../auth/local/LocalAuthContext";

export default function useLocalAuth() {
  const ctx = useContext(LocalAuthContext);
  if (!ctx) throw new Error("useLocalAuth outside LocalAuthProvider");
  return ctx;
}

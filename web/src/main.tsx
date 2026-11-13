import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró el contenedor principal.");
createRoot(root).render(<RouterProvider router={router} />);
import { TanStackDevtools } from "@tanstack/react-devtools"
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"

// Loaded lazily from the root route, in development only. One trigger for
// both panels, and only when the URL carries `?devtools=true`: a floating
// button in any corner ends up under the sidebar footer or a sheet's
// actions, so the developer asks for it instead.
export default function Devtools() {
  return (
    <TanStackDevtools
      config={{
        position: "bottom-right",
        requireUrlFlag: true,
        urlFlag: "devtools",
      }}
      plugins={[
        { name: "TanStack Router", render: <TanStackRouterDevtoolsPanel /> },
        { name: "TanStack Query", render: <ReactQueryDevtoolsPanel /> },
      ]}
    />
  )
}

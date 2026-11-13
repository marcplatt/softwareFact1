import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { expect, test, vi } from "vitest";
import { UserRole } from "~/db/schema";

vi.mock("~/db", () => {
  throw new Error("DevUI must not import the server database into the browser");
});

test("DevUI renders its supplied user count without importing the database", async () => {
  const { DevUI } = await import("./dev-ui");
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <DevUI
          users={[
            { id: 1, name: "First student", role: UserRole.Student },
            { id: 2, name: "Second student", role: UserRole.Student },
          ]}
          currentUser={null}
          devCountry={null}
          countryTierInfo={{ tier: 1, discount: 0, label: "Full price" }}
          countries={[]}
        />
      ),
    },
  ]);
  const html = renderToStaticMarkup(<RouterProvider router={router} />);
  expect(html).toContain("DevUI · 2 users");
});

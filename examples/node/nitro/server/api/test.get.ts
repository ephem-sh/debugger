import { defineHandler } from "nitro"

export default defineHandler((event) => {
  const url = new URL(event.req.url)
  const id = url.searchParams.get("id") || ""

  console.log("test endpoint", { id })

  if (url.searchParams.get("error") === "true") {
    console.error("test error triggered", { id })
    event.res.status = 500
    return { error: "test error", id }
  }

  return { ok: true, id }
})

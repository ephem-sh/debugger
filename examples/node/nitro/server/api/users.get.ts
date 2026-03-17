import { defineHandler } from "nitro"

export default defineHandler(() => {
  console.log("fetching users")
  return { users: ["alice", "bob", "charlie"] }
})

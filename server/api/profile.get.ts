export default eventHandler(async (event) => {
  return (await getSafeUserSession(event)).user
})

export default eventHandler(async (_event) => {
  const photos = await getVisiblePhotos()
  return photos.map(serializePublicPhoto)
})

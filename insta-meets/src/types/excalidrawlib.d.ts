declare module "*.excalidrawlib" {
  const content: {
    type: string
    version: number
    libraryItems: any[]
  }
  export default content
}

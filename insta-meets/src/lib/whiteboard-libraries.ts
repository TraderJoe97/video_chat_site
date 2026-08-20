// Load exclusively from the project's library files in src/exalidraw-libraries/
import stickFiguresLib from "../exalidraw-libraries/stick-figures.json"
import softwareArchLib from "../exalidraw-libraries/software-architecture.json"
import basicUxLib from "../exalidraw-libraries/basic-ux-wireframing-elements.json"
import archComponentsLib from "../exalidraw-libraries/architecture-diagram-components.json"
import umlErLib from "../exalidraw-libraries/UML-ER-library.json"
import awesomeIconsLib from "../exalidraw-libraries/awesome-icons.json"
import drwnioLib from "../exalidraw-libraries/drwnio.json"

function normalizeLibraryItems(libJson: any): any[] {
  if (!libJson) return []
  if (Array.isArray(libJson.libraryItems)) {
    return libJson.libraryItems.map((item: any, idx: number) => {
      if (Array.isArray(item)) {
        return {
          id: `lib-item-${Math.random().toString(36).substring(2, 9)}-${idx}`,
          status: "published",
          elements: item,
          created: Date.now(),
        }
      }
      return {
        id: item.id || `lib-item-${Math.random().toString(36).substring(2, 9)}-${idx}`,
        status: item.status || "published",
        elements: Array.isArray(item.elements) ? item.elements : [],
        created: item.created || Date.now(),
      }
    })
  }
  if (Array.isArray(libJson)) {
    return libJson.map((item: any, idx: number) => ({
      id: item.id || `lib-item-${Math.random().toString(36).substring(2, 9)}-${idx}`,
      status: item.status || "published",
      elements: Array.isArray(item.elements) ? item.elements : (Array.isArray(item) ? item : []),
      created: item.created || Date.now(),
    }))
  }
  return []
}

// Aggregated library items exclusively from src/exalidraw-libraries/
export const DEFAULT_LIBRARY_ITEMS = [
  ...normalizeLibraryItems(stickFiguresLib),
  ...normalizeLibraryItems(softwareArchLib),
  ...normalizeLibraryItems(basicUxLib),
  ...normalizeLibraryItems(archComponentsLib),
  ...normalizeLibraryItems(umlErLib),
  ...normalizeLibraryItems(awesomeIconsLib),
  ...normalizeLibraryItems(drwnioLib),
]

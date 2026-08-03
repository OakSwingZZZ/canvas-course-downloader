/**
 * CourseContext creates and stores the Course data for loading and displaying. Once the data is retrieved using
 * the File System API, the folder refererer is saved to indexeddb so it can be accessed later.
 */

const {
  createContext,
  useContext,
  useState,
  useEffect
} = React;
const CourseContext = createContext(); // Create a context for course data

// Get the IndexdDB tools
const {
  get,
  set,
  del
} = idbKeyval;

/**
 * Creating a context for course data so it can be accessed by all components.
 */

// Helper function to check and request permissions for a handle
async function verifyPermission(directoryHandle, mode = "read") {
  const options = {
    mode
  };

  // Check if we already have permission
  if ((await directoryHandle.queryPermission(options)) === "granted") {
    return true;
  }

  // If not, request permission (this must be triggered by a user gesture, like a button click)
  if ((await directoryHandle.requestPermission(options)) === "granted") {
    return true;
  }
  return false;
}
function CourseContextProvider({
  children
}) {
  const [courseData, setCourseData] = useState(null);
  const [dirHandle, setDirHandle] = useState(null);
  const [isProcessing, setIsProcessing] = useState(true); // Start loading saved data

  // On mount, load previously saved JSON data and the directory handle from IndexedDB
  useEffect(() => {
    async function loadCachedData() {
      try {
        const [cachedData, cachedHandle] = await Promise.all([get("cachedCourseData"), get("courseDirectoryHandle")]);
        if (cachedData) setCourseData(cachedData);
        if (cachedHandle) setDirHandle(cachedHandle);
        console.log("Fetched Course Data!");
      } catch (err) {
        console.error("Failed to load cached data from storage:", err);
      } finally {
        setIsProcessing(false);
      }
    }
    loadCachedData();
  }, []);

  // Initial folder selection (User picks the folder)
  const handleFolderSelect = async () => {
    setIsProcessing(true);
    try {
      // Prompt user for folder access (using File System Access API)
      const handle = await window.showDirectoryPicker();
      let jsonFilesObject = await scrapeJsonFiles(handle);
      if (jsonFilesObject?.manifest?.manifestVersion >= 2) {
        // Save to React State
        setCourseData(jsonFilesObject);
        setDirHandle(handle);

        // Save to IndexedDB
        await set("cachedCourseData", jsonFilesObject);
        await set("courseDirectoryHandle", handle); // <-- Saving the handle
      } else {
        alert("Invalid manifest version. Please select a valid course folder.");
      }
    } catch (err) {
      console.error("Access denied or error digesting folder", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Re-authenticate an existing handle (User grants permission to previously saved folder)
  const reconnectFolder = async () => {
    if (!dirHandle) return;
    setIsProcessing(true);
    try {
      // This will prompt the browser permission dialog if needed
      const hasPermission = await verifyPermission(dirHandle, "read");
      if (hasPermission) {
        // You now have active access to the folder again!
        // Optional: Re-scrape the folder here to get fresh data instead of using cache
        // let freshData = await scrapeJsonFiles(dirHandle);
        console.log("Permission granted! Directory handle is active.");
      } else {
        alert("Permission to access the folder was denied.");
      }
    } catch (err) {
      console.error("Error reconnecting to folder:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Clear stored data
  const clearCourseData = async () => {
    await Promise.all([del("cachedCourseData"), del("courseDirectoryHandle")]);
    setCourseData(null);
    setDirHandle(null);
  };
  return /*#__PURE__*/React.createElement(CourseContext.Provider, {
    value: {
      courseData,
      dirHandle,
      isProcessing,
      handleFolderSelect,
      reconnectFolder,
      // Export the new function
      clearCourseData
    }
  }, children);
}
function useCourseContext() {
  return useContext(CourseContext);
}
// Function to take digest the folder data into every available JSON file
async function scrapeJsonFiles(dirHandle) {
  const jsonFilesObject = {};
  async function walkDirectory(handle) {
    for await (const entry of handle.values()) {
      if (entry.kind === "file" && entry.name.endsWith(".json")) {
        try {
          // Get the standard File object
          const file = await entry.getFile();

          // Read and parse the JSON string
          const text = await file.text();
          const parsedData = JSON.parse(text);
          console.log(`Parsed JSON for file: ${entry.name}`, parsedData);

          // Use the file name as the key, stripping the .json extension
          jsonFilesObject[entry.name.slice(0, -5)] = parsedData;
        } catch (err) {
          console.warn(`Failed to parse JSON for file: ${entry.name}`, err);
        }
      } else if (entry.kind === "directory") {
        // Recurse into nested subfolders
        await walkDirectory(entry);
      }
    }
  }
  await walkDirectory(dirHandle);
  return jsonFilesObject;
}
/**
 * Creating a context so that we can enable navigation throughout the app
 */
const NavigationContext = React.createContext();
function NavigationProvider({
  children
}) {
  const [activeKey, setActiveKey] = useState("frontpage");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
  const [selectedPageUrl, setSelectedPageUrl] = useState(null);
  const [selectedDiscussionId, setSelectedDiscussionId] = useState(null);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState();

  // Navigate to a main section (resets sub-view detail)
  const navigateToSection = key => {
    setActiveKey(key);
    setSelectedAssignmentId(null);
    setSelectedPageUrl(null);
    setSelectedDiscussionId(null);
  };
  // Navigate directly to a specific assignment detail view
  const navigateToAssignment = assignmentId => {
    setActiveKey("assignments"); // Keeps "Assignments" active on the left sidebar!
    setSelectedAssignmentId(assignmentId);
    setSelectedPageUrl(null);
  };
  // Navigate directly to a specific page detail view
  const navigateToPage = pageUrl => {
    setActiveKey("pages"); // Keeps "Pages" active on the left sidebar!
    setSelectedPageUrl(pageUrl);
    setSelectedAssignmentId(null);
  };
  const navigateToDiscussion = discussionId => {
    setActiveKey("discussions"); // Keeps "Pages" active on the left sidebar!
    setSelectedDiscussionId(discussionId);
    setSelectedAssignmentId(null);
  };
  const navigateToAnnouncement = announcementId => {
    setActiveKey("announcements"); // Keeps "Pages" active on the left sidebar!
    setSelectedAnnouncementId(announcementId);
    setSelectedAssignmentId(null);
  };
  return /*#__PURE__*/React.createElement(NavigationContext.Provider, {
    value: {
      activeKey,
      selectedAssignmentId,
      selectedPageUrl,
      selectedDiscussionId,
      selectedAnnouncementId,
      navigateToSection,
      navigateToAssignment,
      navigateToPage,
      navigateToDiscussion,
      navigateToAnnouncement
    }
  }, children);
}
const useNavigation = () => React.useContext(NavigationContext);
/**
 * This function renders the rubric for an assignment's detailed view.
 * @param {*} rubric - The rubric for the assignment.
 * @returns The rubric component for the assignment.
 */
function AssignmentRubric({
  rubric
}) {
  if (!Array.isArray(rubric) || rubric.length === 0) {
    return null;
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "assignment-rubric-container",
    style: {
      marginTop: "1em"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: "1.1em",
      marginBottom: "0.5em",
      color: "#273540"
    }
  }, "Rubric"), /*#__PURE__*/React.createElement("table", {
    className: "rubric-table",
    style: {
      width: "100%",
      borderCollapse: "collapse",
      border: "1px solid #e8eaec",
      fontSize: "14px"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      backgroundColor: "#f2f4f4",
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "8px 12px",
      borderBottom: "1px solid #ccc"
    }
  }, "Criteria"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "8px 12px",
      borderBottom: "1px solid #ccc"
    }
  }, "Ratings"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "8px 12px",
      borderBottom: "1px solid #ccc",
      textAlign: "right"
    }
  }, "Pts"))), /*#__PURE__*/React.createElement("tbody", null, rubric.map((crit, idx) => /*#__PURE__*/React.createElement("tr", {
    key: crit.id || idx,
    style: {
      borderBottom: "1px solid #e8eaec"
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 12px",
      verticalAlign: "top",
      width: "30%",
      borderRight: "1px solid #e8eaec"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "rubric-popover-wrapper"
  }, /*#__PURE__*/React.createElement("strong", null, crit.description), crit.long_description && /*#__PURE__*/React.createElement("div", {
    className: "rubric-popover",
    dangerouslySetInnerHTML: {
      __html: crit.long_description
    }
  })), crit.long_description && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "12px",
      color: "#596a75",
      marginTop: "4px"
    },
    dangerouslySetInnerHTML: {
      __html: crit.long_description
    }
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 12px",
      verticalAlign: "top"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px"
    }
  }, Array.isArray(crit.ratings) && crit.ratings.map((rating, rIdx) => {
    const popoverText = rating.long_description || rating.description;
    return /*#__PURE__*/React.createElement("div", {
      key: rating.id || rIdx,
      className: "rubric-rating-card"
    }, popoverText && /*#__PURE__*/React.createElement("div", {
      className: "rubric-popover",
      dangerouslySetInnerHTML: {
        __html: popoverText
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: "bold",
        color: "#008148"
      }
    }, rating.points, " pts"), /*#__PURE__*/React.createElement("div", null, rating.description));
  }))), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 12px",
      verticalAlign: "top",
      textAlign: "right",
      fontWeight: "bold",
      width: "10%"
    }
  }, crit.points, " pts"))))));
}
/**
 * A component that renders an assignment icon.
 * @description This component is used to display different icons based on the type of the item. Found paths at: https://instructure.design/legacy-icons
 * @param {string} icon_type - The type of the icon to display (lowercase).
 * Inofrmation:  ['File' or 'Page' or 'Discussion' or 'Assignment' or 'Quiz' or 'SubHeader' or 'ExternalUrl' or 'ExternalTool']
 * @param {Object} props - The component props.
 * @param {boolean} props.isModuleItem - Whether the icon is for a module item.
 */
function CanvasItemIcon({
  icon_type,
  isModuleItem
}) {
  function getPathData(icon_type) {
    switch (icon_type) {
      case "assignment":
        return /*#__PURE__*/React.createElement("path", {
          d: "M1468.214 0v564.698h-112.94V112.94H112.94v1694.092h1242.334v-225.879h112.94v338.819H0V0h1468.214Zm129.428 581.311c22.137-22.136 57.825-22.136 79.962 0l225.879 225.879c22.023 22.023 22.023 57.712 0 79.848l-677.638 677.637c-10.616 10.504-24.96 16.49-39.98 16.49h-225.88c-31.17 0-56.469-25.299-56.469-56.47v-225.88c0-15.02 5.986-29.364 16.49-39.867Zm-155.291 314.988-425.895 425.895v146.031h146.03l425.895-425.895-146.03-146.03Zm-764.714 346.047v112.94H338.82v-112.94h338.818Zm225.88-225.88v112.94H338.818v-112.94h564.697Zm734.106-315.44-115.424 115.425 146.03 146.03 115.425-115.423-146.031-146.031ZM1129.395 338.83v451.758H338.82V338.83h790.576Zm-112.94 112.94H451.759v225.878h564.698V451.77Z",
          fillRule: "evenodd"
        });
      case "file":
        // "paperclip" is the icon for files in Canvas
        return /*#__PURE__*/React.createElement("path", {
          d: "M1752.768 221.109C1532.646.986 1174.283.986 954.161 221.109l-838.588 838.588c-154.052 154.165-154.052 404.894 0 558.946 149.534 149.421 409.976 149.308 559.059 0l758.738-758.626c87.982-88.094 87.982-231.417 0-319.51-88.32-88.208-231.642-87.982-319.51 0l-638.796 638.908 79.85 79.849 638.795-638.908c43.934-43.821 115.539-43.934 159.812 0 43.934 44.047 43.934 115.877 0 159.812l-758.739 758.625c-110.23 110.118-289.355 110.005-399.36 0-110.118-110.117-110.005-289.242 0-399.247l838.588-838.588c175.963-175.962 462.382-176.188 638.909 0 176.075 176.188 176.075 462.833 0 638.908l-798.607 798.72 79.849 79.85 798.607-798.72c220.01-220.123 220.01-578.485 0-798.607",
          fillRule: "evenodd"
        });
      case "discussion":
        return /*#__PURE__*/React.createElement("path", {
          d: "M677.647 16v338.936h112.941V129.054h1016.47V919.53h-225.994v259.765L1321.412 919.53h-79.172V467.878H0v1016.47h338.71v418.9l417.996-418.9h485.534v-451.877h32.753l419.125 419.124v-419.124H1920V16H677.647ZM338.79 919.563h564.706v-112.94H338.79v112.94Zm0 225.883h338.936v-113.054H338.79v113.054Zm-225.85-564.74h1016.47v790.701H710.4L451.652 1631.06v-259.652h-338.71V580.706Z",
          fillRule: "evenodd"
        });
      case "externaltool": // "externaltool" is the icon for external tools in Canvas
      case "externalurl":
        // "link" is the icon for external links in Canvas
        return /*#__PURE__*/React.createElement("path", {
          d: "M1866.003 351.563 1565.128 50.575c-69.46-67.652-180.932-67.426-248.923.565L906.23 461.116c-68.33 68.443-68.33 179.69.113 248.132l31.623 31.624 79.737-79.963-31.624-31.51c-24.282-24.396-24.282-64.038 0-88.433l409.977-409.977c24.508-24.395 64.828-24.17 89.675 0l299.859 299.972c24.734 25.186 24.847 65.619.564 90.014l-409.976 409.977c-24.508 24.282-64.15 24.282-88.546 0l-110.795-110.909 159.473-159.36-79.85-79.85-435.614 435.502-109.779-109.779c-32.866-33.656-76.8-52.292-123.67-52.63-43.596 1.694-92.273 18.296-126.156 52.178L51.377 1316.081c-68.442 68.442-68.442 179.69 0 248.132l301.553 301.553c34.108 34.108 79.059 51.275 124.01 51.275 44.95 0 89.9-17.167 124.122-51.275l409.976-409.977c33.77-33.882 52.405-78.607 52.066-126.042-.226-46.984-18.974-90.918-52.066-123.219l-30.494-30.494-79.85 79.85 30.946 30.945c11.86 11.633 18.41 27.106 18.523 43.595.113 16.942-6.664 33.092-18.974 45.516l-409.977 409.976c-23.492 23.492-64.94 23.492-88.433 0l-301.553-301.553c-11.746-11.746-18.183-27.444-18.183-44.273 0-16.715 6.437-32.414 18.183-44.16l409.977-409.976c12.197-12.31 28.235-19.087 45.063-19.087h.452c16.49.113 31.962 6.663 43.934 19.087l110.344 110.23-162.184 162.297 79.85 79.85 438.324-438.438 110.796 110.908c34.334 34.221 79.171 51.275 124.122 51.275 44.95 0 89.901-17.054 124.122-51.275l409.977-409.977c67.877-67.99 67.99-179.463 0-249.26",
          fillRule: "evenodd"
        });
      case "page":
        // "document" is the icon for pages in Canvas
        return /*#__PURE__*/React.createElement("path", {
          d: "M1706.235 1807.059H350.941V112.94h903.53v451.765h451.764v1242.353Zm-338.823-1670.74 315.443 315.447h-315.443V136.32Zm402.182 242.487L1440.372 49.58C1408.296 17.62 1365.717 0 1320.542 0H238v1920h1581.175V498.635c0-45.176-17.618-87.755-49.58-119.83ZM576.823 1242.353h790.589v-112.94H576.823v112.94Zm0-451.765h903.53V677.647h-903.53v112.941Zm0 677.647h451.765v-112.941H576.823v112.941Zm0-451.764h677.648V903.53H576.823v112.941Zm0-451.765h451.765V451.765H576.823v112.941Z",
          fillRule: "evenodd"
        });
      case "quiz":
        // externaltool
        return /*#__PURE__*/React.createElement("g", {
          fillRule: "evenodd"
        }, /*#__PURE__*/React.createElement("path", {
          d: "m746.255 1466.764 80.484 80.712-248.748 248.634-80.484-80.598 248.748-248.748Zm-165.904-165.836 80.598 80.598-331.626 331.626-80.598-80.598 331.626-331.626Zm-165.847-165.721 80.598 80.598-414.504 414.504L0 1549.71l414.504-414.504ZM1119.32 264.6c356.478-356.478 725.268-178.296 729.03-176.472l17.1 8.436 8.436 17.1c1.824 3.648 180.006 372.438-176.586 729.03l-146.604 146.604-2.622 665.874-222.642 222.642-331.626-331.512-578.094-578.094-331.626-331.74 222.642-222.642 665.874-2.508Zm316.92 839.154-361.836 361.95 251.028 250.914 108.87-108.87 1.938-503.994Zm343.026-921.348c-69.084-25.992-321.366-95.304-579.348 162.792l-623.01 623.01 416.898 416.898 622.896-623.01c256.956-256.956 187.986-511.176 162.564-579.69Zm-921.12 343.368-503.994 1.824-108.87 108.87L496.31 887.61l361.836-361.836Z"
        }), /*#__PURE__*/React.createElement("path", {
          d: "M1534.987 372.558c-51.072-1.368-131.67 12.768-213.294 94.392l-40.47 40.356 173.394 173.28 40.356-40.242c82.194-82.308 96.9-161.31 94.848-213.18l-2.166-52.554-52.668-2.052Z"
        }));
      case "subheader":
        // There is no icon for subheaders in Canvas, so we return an empty fragment, allowing css to display: none the parent's parent div.
        return /*#__PURE__*/React.createElement(React.Fragment, null);
      default:
        return /*#__PURE__*/React.createElement("path", {
          d: "M1468.214 0v564.698h-112.94V112.94H112.94v1694.092h1242.334v-225.879h112.94v338.819H0V0h1468.214Zm129.428 581.311c22.137-22.136 57.825-22.136 79.962 0l225.879 225.879c22.023 22.023 22.023 57.712 0 79.848l-677.638 677.637c-10.616 10.504-24.96 16.49-39.98 16.49h-225.88c-31.17 0-56.469-25.299-56.469-56.47v-225.88c0-15.02 5.986-29.364 16.49-39.867Zm-155.291 314.988-425.895 425.895v146.031h146.03l425.895-425.895-146.03-146.03Zm-764.714 346.047v112.94H338.82v-112.94h338.818Zm225.88-225.88v112.94H338.818v-112.94h564.697Zm734.106-315.44-115.424 115.425 146.03 146.03 115.425-115.423-146.031-146.031ZM1129.395 338.83v451.758H338.82V338.83h790.576Zm-112.94 112.94H451.759v225.878h564.698V451.77Z",
          fillRule: "evenodd"
        });
    }
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "canvas-item-icon"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 1920 1920",
    xmlns: "http://www.w3.org/2000/svg",
    style: {
      fill: isModuleItem ? "#03893d" : "#47535c"
    }
  }, getPathData(icon_type)));
}
/**
 * Renders the submission for an assignment.
 * @param {Object} assignment - The assignment to render the submission for.
 * @returns {JSX.Element|null} The submission component.
 */
function CanvasSubmission({
  assignment
}) {
  const {
    dirHandle
  } = useCourseContext();
  if (!assignment || !assignment.submission) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "1rem",
        color: "#6b7280"
      }
    }, "No submission data available.");
  }

  // If we are looking at an assignment but haven't re-authenticated the folder handle yet
  if (!dirHandle) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "1.5rem",
        backgroundColor: "#fff3cd",
        color: "#856404",
        border: "1px solid #ffeeba",
        borderRadius: "0.25rem",
        marginTop: "1rem"
      }
    }, /*#__PURE__*/React.createElement("strong", null, "Permission Required:"), " We need permission to read your local files to show submissions. Please select your folder from the Dashboard again.");
  }
  const {
    submission
  } = assignment;
  const renderSubmissionBody = () => {
    switch (submission.submission_type) {
      case "online_upload":
        if (!submission.attachments || submission.attachments.length === 0) {
          return /*#__PURE__*/React.createElement("p", {
            style: {
              color: "#6b7280"
            }
          }, "No files were attached to this submission.");
        }
        return /*#__PURE__*/React.createElement("div", null, submission.attachments.map(attachment => /*#__PURE__*/React.createElement(LocalAttachmentViewer, {
          key: attachment.id,
          attachment: attachment,
          assignment: assignment
        })));
      case "online_text_entry":
        return /*#__PURE__*/React.createElement("div", {
          style: {
            padding: "1rem",
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.25rem",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            overflowX: "auto"
          },
          dangerouslySetInnerHTML: {
            __html: submission.body
          }
        });
      case "online_url":
        return /*#__PURE__*/React.createElement("div", {
          style: {
            padding: "1rem",
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.25rem",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
          }
        }, /*#__PURE__*/React.createElement("p", {
          style: {
            margin: "0 0 0.5rem 0",
            color: "#4b5563"
          }
        }, "Submitted URL:"), /*#__PURE__*/React.createElement("a", {
          href: submission.url,
          target: "_blank",
          rel: "noopener noreferrer",
          style: {
            color: "#2563eb",
            textDecoration: "none",
            wordBreak: "break-all"
          }
        }, submission.url));
      default:
        return /*#__PURE__*/React.createElement("div", {
          style: {
            padding: "1rem",
            backgroundColor: "#fefce8",
            border: "1px solid #fef08a",
            borderRadius: "0.25rem",
            color: "#854d0e"
          }
        }, "Unsupported submission type: ", submission.submission_type);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "56rem",
      margin: "1em 0",
      padding: "1.5rem",
      backgroundColor: "#f9fafb",
      borderRadius: "8px",
      border: "1px solid #e8eaec"
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      marginBottom: "1.5rem",
      borderBottom: "1px solid #e5e7eb",
      paddingBottom: "1rem"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: "1.25rem",
      fontWeight: "bold",
      color: "#111827",
      margin: "0 0 0.5rem 0"
    }
  }, "Submission"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "1rem",
      fontSize: "0.875rem",
      color: "#4b5563",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0
    }
  }, "Status: ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: "600",
      textTransform: "capitalize"
    }
  }, submission.workflow_state)), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0
    }
  }, "Submitted: ", new Date(submission.submitted_at).toLocaleString()))), /*#__PURE__*/React.createElement("section", null, renderSubmissionBody()));
}
/**
 * Collapsible Table Component
 * @param {Object} props
 * @param {string} props.title - The title of the collapsible table.
 * @param {React.ReactNode} props.children - The content to be displayed inside.
 * @param {React.CSSProperties} props.style - The style to be applied to the collapsible table.
 * @param {boolean} props.isModuleItem - Whether the table is a module item.
 * @param {boolean} props.isOpen - Whether the table is open.
 * @param {Function} props.onToggle - The function to call when the table is toggled.
 */
function CollapseTable({
  title,
  children,
  style,
  isModuleItem,
  isOpen: controlledIsOpen,
  onToggle
}) {
  // Fallback internal state for standalone usage outside of ModulesPage
  const [internalIsOpen, setInternalIsOpen] = useState(true);
  const isControlled = typeof controlledIsOpen !== "undefined";
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  const toggleOpen = () => {
    if (isControlled && onToggle) {
      onToggle();
    } else {
      setInternalIsOpen(prev => !prev);
    }
  };

  // Safe normalization: Converts single elements, strings, or arrays into a clean array
  const childList = React.Children.toArray(children);
  return /*#__PURE__*/React.createElement("div", {
    className: "collapse-table",
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    className: "collapse-table-header",
    onClick: toggleOpen
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "10px",
      marginLeft: "12px",
      display: "inline-block",
      transform: "scaleY(.75)",
      transformOrigin: "middle"
    }
  }, !isOpen ? "▲" : "▼"), /*#__PURE__*/React.createElement("span", null, title)), isOpen && /*#__PURE__*/React.createElement("div", {
    className: "collapse-table-content"
  }, childList.length > 0 ? /*#__PURE__*/React.createElement("ul", {
    className: "collapse-table-list"
  }, childList.map((child, index) => /*#__PURE__*/React.createElement("li", {
    key: child.key || index,
    className: "collapse-table-item",
    style: {
      borderLeft: isModuleItem ? "4px solid #03893d" : "1px solid #e8eaec"
    }
  }, child))) : /*#__PURE__*/React.createElement("div", {
    className: "collapse-table-empty"
  }, "No items to display.")));
}
/**
 * Renders the details of a list item in a collapsible table. Not sure why there are so many props... was one of the first components.
 * @param {string} props.title - The title of the list item.
 * @param {boolean} props.closed - Whether the list item is closed.
 * @param {string} props.dueDate - The due date of the list item.
 * @param {string} props.grade - The grade of the list item.
 * @param {string} props.maxGrade - The maximum grade of the list item.
 * @param {Object} props.assignment - The assignment of the list item.
 * @param {string} props.pageUrl - The page URL of the list item.
 * @param {boolean} props.isModuleItem - Whether the list item is a module item.
 * @param {string} props.type - The type of the list item.
 * @param {number} props.indent - The indent of the list item.
 */
function CollapseListItemDetails({
  title,
  closed,
  dueDate,
  grade,
  maxGrade,
  assignment,
  pageUrl,
  isModuleItem,
  type,
  indent
}) {
  const {
    navigateToAssignment,
    navigateToPage
  } = useNavigation();
  const {
    reconnectFolder
  } = useCourseContext();
  return /*#__PURE__*/React.createElement("div", {
    className: "assignment-details",
    style: {
      display: "flex",
      alignItems: "center",
      paddingLeft: `${indent * 1}em`
    }
  }, /*#__PURE__*/React.createElement(CanvasItemIcon, {
    icon_type: type?.toLowerCase(),
    isModuleItem: isModuleItem
  }), /*#__PURE__*/React.createElement("div", {
    className: "assignment-info",
    style: {
      display: "flex",
      flexDirection: "column",
      marginLeft: "0em"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    className: "assignment-info-title",
    style: {
      fontSize: "16px",
      margin: "0",
      color: "#273450",
      cursor: assignment || pageUrl ? "pointer" : "default"
    },
    onClick: () => {
      reconnectFolder();
      if (assignment?.id) {
        navigateToAssignment(assignment.id);
      } else if (pageUrl) {
        navigateToPage(pageUrl);
      }
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: assignment != undefined ? "inherit" : "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "assignment-info-item"
  }, /*#__PURE__*/React.createElement("strong", null, closed ? "Closed" : "Open")), /*#__PURE__*/React.createElement("span", {
    className: "assignment-info-item"
  }, /*#__PURE__*/React.createElement("strong", null, "Due"), " ", dueDate), !assignment?.submission_types?.includes("none") && assignment?.grading_type == "points" && grade && maxGrade && /*#__PURE__*/React.createElement("span", {
    className: "assignment-info-item"
  }, /*#__PURE__*/React.createElement("strong", null, grade), "/", maxGrade, " pts"))));
}
/**
 * Takes a type of ["missing", "late"]
 * returns a span with the appropriate color and text for the context pill.
 * @param {string} type - The type of context pill to display.
 * @returns {React.Component} either styled missing or late
 */
function ContextPill({
  type
}) {
  const commonStyles = {
    padding: "2px 6px",
    borderRadius: "4px",
    fontSize: "14px",
    fontWeight: "light",
    textTransform: "lowercase",
    borderRadius: "999rem"
  };
  let borderColor = type === "missing" ? "rgb(230, 36, 41)" : type === "late" ? "rgb(43, 122, 188)" : "#e2e3e5";
  let textColor = type === "missing" ? "rgb(230, 36, 41)" : type === "late" ? "rgb(43, 122, 188)" : "#383d41";
  return /*#__PURE__*/React.createElement("span", {
    style: {
      ...commonStyles,
      border: `1px solid ${borderColor}`,
      color: textColor
    }
  }, type);
}
/**
 * CourseList component that displays a list of course elements. It checks if the elements prop is valid and renders a list of links to the course items.
 * elements: {key: string, title: string}[]
 * activeKey: string
 * callback: function
 */
function CourseList({
  elements,
  activeKey,
  callback
}) {
  if (!elements || elements?.length === 0) {
    return null;
  }
  let courseSubtitle = "Course Menu";
  const {
    courseData
  } = useCourseContext();
  if (courseData) {
    courseSubtitle = courseData?.manifest?.courseTerm?.name || "Course Menu";
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "course-item-list",
    id: "course_item_list",
    style: {
      position: "sticky",
      // Makes it sticky
      top: "0px",
      // Distance from top of screen when scrolling
      maxHeight: "calc(100vh - 40px)",
      // Optional: Keeps long menus scrollable within viewport
      overflowY: "auto",
      // Optional: Allows scrolling inside sidebar if menu is long
      flexShrink: 0,
      // Prevents content on the right from squishing the sidebar
      maxWidth: "192px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "couse_subtitle",
    style: {
      fontSize: "11px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      margin: "3em 1em 0em 1.5em",
      paddingRight: "1em",
      color: "#273540"
    }
  }, /*#__PURE__*/React.createElement("i", null, courseSubtitle)), /*#__PURE__*/React.createElement("nav", null, /*#__PURE__*/React.createElement("ul", {
    id: "courseList",
    style: {
      display: "block",
      listStyle: "none",
      padding: 0
    }
  }, elements.map((element, index) => /*#__PURE__*/React.createElement("li", {
    className: `course-item ${activeKey === element.key ? "active-course-item" : ""}`,
    key: element.key || index
  }, /*#__PURE__*/React.createElement("a", {
    onClick: e => {
      e.preventDefault();
      handleCourseItemClick(element.key, callback);
    },
    href: "#"
  }, element.title))))));
}

/**
 * HandleCourseItemClick function that is called when a course item is clicked. Currently, it does nothing but can be extended to handle navigation or other actions.
 * key: string
 * callback: function
 */
function handleCourseItemClick(key, callback) {
  console.log("Course item clicked:", key);
  if (callback) {
    callback(key);
  }
}
/**
 * Course picker dialog that allows the user to select a course folder and load the course data. Utilizes the CourseContext to manage the course data and processing state.
 */
function CoursePicker() {
  const {
    handleFolderSelect,
    isProcessing
  } = useCourseContext();
  return /*#__PURE__*/React.createElement("div", {
    className: "course-picker"
  }, /*#__PURE__*/React.createElement("h1", null, "Welcome to the Offline Course Viewer"), /*#__PURE__*/React.createElement("p", null, "Please select a course folder to begin. The folder should contain the course content and metadata."), /*#__PURE__*/React.createElement("button", {
    onClick: handleFolderSelect,
    disabled: isProcessing
  }, isProcessing ? "Processing..." : "Select Course Folder"));
}
/**
 * Uses mammoth to convert doc and docx to local attatchments
 * @param {*} fileObject - The file object to convert.
 * @param {*} fileUrl - The URL of the file to convert.
 * @returns The docx viewer component for the assignment.
 */
function DocxMemoryViewer({
  fileObject,
  fileUrl
}) {
  const [htmlContent, setHtmlContent] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function convertDocx() {
      try {
        let arrayBuffer = null;
        if (fileObject) {
          arrayBuffer = await fileObject.arrayBuffer();
        } else if (fileUrl) {
          const res = await fetch(fileUrl);
          arrayBuffer = await res.arrayBuffer();
        }
        if (!arrayBuffer) return;
        // Converts binary .docx directly to raw HTML string
        const result = await window.mammoth.convertToHtml({
          arrayBuffer
        });
        setHtmlContent(result.value);
      } catch (err) {
        console.error("Failed to parse docx", err);
      } finally {
        setLoading(false);
      }
    }
    if (fileObject || fileUrl) convertDocx();
  }, [fileObject, fileUrl]);
  if (loading) return /*#__PURE__*/React.createElement("div", null, "Parsing document...");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "1.5rem",
      backgroundColor: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: "0.25rem",
      maxHeight: "30rem",
      overflowY: "auto",
      width: "100%"
    },
    dangerouslySetInnerHTML: {
      __html: htmlContent
    }
  });
}
/** Sub-component to handle asynchronous file loading and memory cleanup
 * @param {Object} attachment - The attachment object
 * @param {Object} assignment - The assignment object
 * @param {Object} file - The file object
 * @returns {React.Component} The local attachment viewer
 */
function LocalAttachmentViewer({
  attachment,
  assignment,
  file
}) {
  const {
    dirHandle,
    courseData
  } = useCourseContext();
  const [fileUrl, setFileUrl] = useState(null);
  const [fileObject, setFileObject] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const targetFile = file || attachment;
  const rawFileName = targetFile ? targetFile.display_name || targetFile.filename || "" : "";
  const sanitizedAssignmentName = assignment ? sanitizeFilename(assignment.name) : "";
  const sanitizedFileName = sanitizeFilename(rawFileName);

  // Fetch the file from the File System API and create a readable URL
  useEffect(() => {
    if (!targetFile) {
      setError("No file specified.");
      setIsLoading(false);
      return;
    }
    if (!dirHandle) {
      setError("No directory access.");
      setIsLoading(false);
      return;
    }
    let objectUrl = null;
    async function loadLocalFile() {
      try {
        setIsLoading(true);
        setError(null);
        if (!dirHandle) {
          throw new Error("No directory access handle available.");
        }
        let matchedFileHandle = null;
        if (assignment) {
          // 1. Access the "Submissions" directory
          const submissionsHandle = await dirHandle.getDirectoryHandle("Submissions");

          // Targets for assignment folder
          const targetFolderSanitized = sanitizeFilename(assignment.name).toLowerCase().trim();
          const targetFolderRaw = (assignment.name || "").toLowerCase().trim();
          let assignmentHandle = null;

          // 2. FIND ASSIGNMENT FOLDER
          try {
            assignmentHandle = await submissionsHandle.getDirectoryHandle(targetFolderSanitized);
          } catch (err) {
            for await (const entry of submissionsHandle.values()) {
              if (entry.kind === "directory") {
                const folderName = entry.name.toLowerCase().trim();
                const folderSanitized = sanitizeFilename(entry.name).toLowerCase().trim();
                if (folderName === targetFolderRaw || folderName === targetFolderSanitized || folderSanitized === targetFolderSanitized || folderName.includes(targetFolderSanitized) || targetFolderSanitized.includes(folderName)) {
                  assignmentHandle = entry;
                  break;
                }
              }
            }
          }
          if (!assignmentHandle) {
            throw new Error(`Assignment folder not found for: "${assignment.name}"`);
          }

          // Prepare target file strings
          const rawTarget = (targetFile.display_name || targetFile.filename || "").toLowerCase().trim();
          const sanitizedTarget = sanitizeFilename(rawTarget).toLowerCase().trim();
          const currentAttemptNumber = assignment?.submission?.attempt;
          const expectedAttemptPrefix = currentAttemptNumber ? `attempt ${currentAttemptNumber} - ` : null;
          const attemptPrefixRegex = /^attempt\s+\d+\s*-\s*/i;

          // 3. SEARCH FOR ATTACHMENT FILE IN ASSIGNMENT FOLDER
          for await (const entry of assignmentHandle.values()) {
            if (entry.kind === "file") {
              const diskNameRaw = entry.name.toLowerCase().trim();
              const diskNameSanitized = sanitizeFilename(entry.name).toLowerCase().trim();
              const diskNameUnprefixedRaw = diskNameRaw.replace(attemptPrefixRegex, "").trim();
              const diskNameUnprefixedSanitized = sanitizeFilename(diskNameUnprefixedRaw).toLowerCase().trim();
              const matchesExactAttemptPrefix = expectedAttemptPrefix && diskNameRaw.startsWith(expectedAttemptPrefix);
              const isMatch = matchesExactAttemptPrefix && diskNameUnprefixedSanitized === sanitizedTarget || diskNameRaw === rawTarget || diskNameRaw === sanitizedTarget || diskNameSanitized === sanitizedTarget || diskNameUnprefixedRaw === rawTarget || diskNameUnprefixedRaw === sanitizedTarget || diskNameUnprefixedSanitized === sanitizedTarget || diskNameUnprefixedRaw.replace(/\+/g, " ") === rawTarget || diskNameRaw.includes(sanitizedTarget) && diskNameRaw.endsWith(sanitizedTarget.slice(-5));
              if (isMatch) {
                matchedFileHandle = entry;
                break;
              }
            }
          }
          if (!matchedFileHandle) {
            throw new Error(`File "${rawTarget}" not found in folder "${assignmentHandle.name}"`);
          }
        } else {
          // --- COURSE FILE (Files/...) LOOKUP ---
          const filesHandle = await dirHandle.getDirectoryHandle("Files");

          // Determine subfolder path from folder_id in courseData.Files.folders
          let folderPathParts = [];
          if (targetFile.folder_id && courseData?.Files?.folders) {
            const foldersArray = Array.isArray(courseData.Files.folders) ? courseData.Files.folders : Object.values(courseData.Files.folders);
            const folderMap = new Map(foldersArray.map(f => [String(f.id), f]));
            const fileFolder = folderMap.get(String(targetFile.folder_id));
            if (fileFolder && fileFolder.full_name) {
              let fn = fileFolder.full_name;
              if (fn.toLowerCase().startsWith("course files")) {
                fn = fn.slice("course files".length);
              }
              folderPathParts = fn.split("/").map(s => s.trim()).filter(Boolean);
            } else if (fileFolder) {
              const parts = [];
              let curr = fileFolder;
              while (curr && curr.parent_folder_id !== null && curr.name !== "course files") {
                parts.unshift(curr.name);
                curr = folderMap.get(String(curr.parent_folder_id));
              }
              folderPathParts = parts;
            }
          }

          // Traverse into target folder if specified
          let targetDirHandle = filesHandle;
          for (const part of folderPathParts) {
            let nextHandle = null;
            const partRaw = part.toLowerCase().trim();
            const partSanitized = sanitizeFilename(part).toLowerCase().trim();
            try {
              nextHandle = await targetDirHandle.getDirectoryHandle(part);
            } catch (e) {
              try {
                nextHandle = await targetDirHandle.getDirectoryHandle(sanitizeFilename(part));
              } catch (e2) {
                for await (const entry of targetDirHandle.values()) {
                  if (entry.kind === "directory") {
                    const entryRaw = entry.name.toLowerCase().trim();
                    const entrySanitized = sanitizeFilename(entry.name).toLowerCase().trim();
                    if (entryRaw === partRaw || entrySanitized === partSanitized || entrySanitized === sanitizeFilename(partRaw)) {
                      nextHandle = entry;
                      break;
                    }
                  }
                }
              }
            }
            if (nextHandle) {
              targetDirHandle = nextHandle;
            } else {
              break;
            }
          }
          const rawTarget = (targetFile.display_name || targetFile.filename || "").toLowerCase().trim();
          const sanitizedTarget = sanitizeFilename(rawTarget).toLowerCase().trim();

          // Search inside targetDirHandle
          for await (const entry of targetDirHandle.values()) {
            if (entry.kind === "file") {
              const diskNameRaw = entry.name.toLowerCase().trim();
              const diskNameSanitized = sanitizeFilename(entry.name).toLowerCase().trim();
              if (diskNameRaw === rawTarget || diskNameRaw === sanitizedTarget || diskNameSanitized === sanitizedTarget || diskNameRaw.replace(/\+/g, " ") === rawTarget || diskNameSanitized.replace(/\+/g, " ") === sanitizedTarget) {
                matchedFileHandle = entry;
                break;
              }
            }
          }

          // Fallback 1: Search top-level Files directory if targetDirHandle was a subfolder
          if (!matchedFileHandle && targetDirHandle !== filesHandle) {
            for await (const entry of filesHandle.values()) {
              if (entry.kind === "file") {
                const diskNameRaw = entry.name.toLowerCase().trim();
                const diskNameSanitized = sanitizeFilename(entry.name).toLowerCase().trim();
                if (diskNameRaw === rawTarget || diskNameRaw === sanitizedTarget || diskNameSanitized === sanitizedTarget || diskNameRaw.replace(/\+/g, " ") === rawTarget) {
                  matchedFileHandle = entry;
                  break;
                }
              }
            }
          }

          // Fallback 2: Recursive search under filesHandle if still not found
          if (!matchedFileHandle) {
            async function findRecursive(dir) {
              for await (const entry of dir.values()) {
                if (entry.kind === "file") {
                  const diskNameRaw = entry.name.toLowerCase().trim();
                  const diskNameSanitized = sanitizeFilename(entry.name).toLowerCase().trim();
                  if (diskNameRaw === rawTarget || diskNameRaw === sanitizedTarget || diskNameSanitized === sanitizedTarget || diskNameRaw.replace(/\+/g, " ") === rawTarget) {
                    return entry;
                  }
                } else if (entry.kind === "directory") {
                  const found = await findRecursive(entry);
                  if (found) return found;
                }
              }
              return null;
            }
            matchedFileHandle = await findRecursive(filesHandle);
          }
          if (!matchedFileHandle) {
            throw new Error(`File "${rawTarget}" not found in Files directory.`);
          }
        }

        // 4. Retrieve File Object
        const loadedFile = await matchedFileHandle.getFile();
        setFileObject(loadedFile);

        // 5. Create Object URL
        objectUrl = URL.createObjectURL(loadedFile);
        setFileUrl(objectUrl);
      } catch (err) {
        console.warn(`Could not load local file: "${rawFileName}"`, err);
        setError(err.message || "File or directory not found locally.");
      } finally {
        setIsLoading(false);
      }
    }
    loadLocalFile();

    // CRITICAL: Prevent memory leaks by revoking the URL when the component unmounts
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [dirHandle, courseData, sanitizedAssignmentName, sanitizedFileName, targetFile?.id, targetFile?.folder_id]);
  const mimeClass = getMimeClass(targetFile);
  const formattedSize = targetFile?.size ? (targetFile.size / 1024).toFixed(1) + " KB" : "-";
  if (isLoading) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "1rem",
        backgroundColor: "#f3f4f6",
        border: "1px solid #e5e7eb",
        borderRadius: "0.25rem",
        marginBottom: "1rem"
      }
    }, "Loading ", rawFileName, "...");
  }
  if (error) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "1rem",
        backgroundColor: "#fef2f2",
        border: "1px solid #fecaca",
        color: "#991b1b",
        borderRadius: "0.25rem",
        marginBottom: "1rem"
      }
    }, error, " (", sanitizedFileName, ")");
  }
  let content;
  switch (mimeClass) {
    case "image":
      content = /*#__PURE__*/React.createElement("img", {
        src: fileUrl,
        alt: rawFileName,
        style: {
          maxWidth: "100%",
          height: "auto",
          border: "1px solid #e5e7eb",
          borderRadius: "0.25rem"
        }
      });
      break;
    case "video":
      content = /*#__PURE__*/React.createElement("video", {
        controls: true,
        style: {
          width: "100%",
          maxWidth: "42rem",
          border: "1px solid #e5e7eb",
          borderRadius: "0.25rem"
        }
      }, /*#__PURE__*/React.createElement("source", {
        src: fileUrl
      }), "Your browser does not support the video tag.");
      break;
    case "pdf":
    case "text":
    case "html":
      content = /*#__PURE__*/React.createElement("iframe", {
        src: fileUrl,
        title: rawFileName,
        style: {
          width: "100%",
          height: "24rem",
          border: "1px solid #e5e7eb",
          borderRadius: "0.25rem",
          backgroundColor: "#fff"
        }
      });
      break;
    case "doc":
      // Render .docx directly to HTML in memory!
      content = /*#__PURE__*/React.createElement(DocxMemoryViewer, {
        fileObject: fileObject,
        fileUrl: fileUrl
      });
      break;
    case "ppt":
      content = /*#__PURE__*/React.createElement(PptxMemoryViewer, {
        fileObject: fileObject,
        fileUrl: fileUrl
      });
      break;
    case "xls":
      content = /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "2rem",
          backgroundColor: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: "0.25rem",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        }
      }, /*#__PURE__*/React.createElement("svg", {
        style: {
          width: "3rem",
          height: "3rem",
          color: "#3b82f6",
          marginBottom: "0.75rem"
        },
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24"
      }, /*#__PURE__*/React.createElement("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2",
        d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      })), /*#__PURE__*/React.createElement("p", {
        style: {
          color: "#374151",
          fontWeight: "500",
          margin: "0 0 0.25rem 0"
        }
      }, "Local Document File"), /*#__PURE__*/React.createElement("p", {
        style: {
          fontSize: "0.875rem",
          color: "#6b7280",
          margin: "0 0 1rem 0"
        }
      }, "Browsers cannot preview ", mimeClass, " files directly."), /*#__PURE__*/React.createElement("a", {
        href: fileUrl,
        download: sanitizedFileName // Prompts browser to "save as" so user can open natively
        ,
        style: {
          backgroundColor: "#dbeafe",
          color: "#1d4ed8",
          padding: "0.5rem 1rem",
          borderRadius: "0.25rem",
          fontWeight: "500",
          textDecoration: "none"
        }
      }, "Extract to view"));
      break;
    default:
      content = /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "1rem",
          backgroundColor: "#f3f4f6",
          border: "1px solid #e5e7eb",
          borderRadius: "0.25rem",
          textAlign: "center"
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          color: "#4b5563",
          margin: 0
        }
      }, "Preview not available for this file type."));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: "1.5rem",
      backgroundColor: "#fff",
      padding: "1rem",
      borderRadius: "0.5rem",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      border: "1px solid #e5e7eb"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "0.75rem"
    }
  }, /*#__PURE__*/React.createElement("h4", {
    title: rawFileName,
    style: {
      fontWeight: "600",
      color: "#1f2937",
      margin: 0,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: "60%"
    }
  }, rawFileName), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "0.75rem",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "0.75rem",
      color: "#6b7280"
    }
  }, formattedSize), /*#__PURE__*/React.createElement("a", {
    href: fileUrl,
    download: sanitizedFileName,
    style: {
      backgroundColor: "#2563eb",
      color: "#fff",
      fontSize: "0.875rem",
      padding: "0.25rem 0.75rem",
      borderRadius: "0.25rem",
      textDecoration: "none"
    }
  }, "Extract"))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      display: "flex",
      justifyContent: "center",
      backgroundColor: "#f9fafb",
      borderRadius: "0.25rem",
      padding: "0.5rem",
      boxSizing: "border-box"
    }
  }, content));
}
/**
 * This function renders a PPTX file to an HTML page using the pptxviewjs library.
 * @param {*} fileObject - The file object to render.
 * @param {*} fileName - The name of the file to render.
 * @returns The pptx viewer component for the assignment.
 */
function PptxMemoryViewer({
  fileObject,
  fileName = "presentation.pptx"
}) {
  const canvasRef = React.useRef(null);
  const viewerRef = React.useRef(null);
  const [loading, setLoading] = useState(true);
  const [renderFailed, setRenderFailed] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState(null);

  // Generate fallback URL for extraction if render fails
  useEffect(() => {
    if (!fileObject) return;
    const url = URL.createObjectURL(fileObject);
    setFallbackUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [fileObject]);
  useEffect(() => {
    let isMounted = true;
    async function renderSlides() {
      if (!fileObject || !canvasRef.current) return;
      try {
        setLoading(true);
        const ViewerClass = window.PPTXViewer || window.PptxViewJS && window.PptxViewJS.PPTXViewer || window.pptxviewjs && window.pptxviewjs.PPTXViewer || window.PptxViewJS;
        if (!ViewerClass) {
          throw new Error("PptxViewJS script tag not loaded or global unavailable.");
        }
        const viewer = new ViewerClass({
          canvas: canvasRef.current
        });
        viewerRef.current = viewer;
        const arrayBuffer = await fileObject.arrayBuffer();
        await viewer.loadFile(arrayBuffer);
        await viewer.render();
      } catch (err) {
        console.warn("PptxViewJS render failed, switching to extraction fallback:", err);
        if (isMounted) {
          setRenderFailed(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    renderSlides();
    return () => {
      isMounted = false;
    };
  }, [fileObject]);
  const handleNextSlide = async () => {
    try {
      if (viewerRef.current?.nextSlide) {
        await viewerRef.current.nextSlide();
      }
    } catch (e) {
      console.log("End of presentation reached.");
    }
  };
  const handlePrevSlide = async () => {
    try {
      if (viewerRef.current?.previousSlide) {
        await viewerRef.current.previousSlide();
      }
    } catch (e) {
      console.log("Beginning of presentation reached.");
    }
  };
  if (renderFailed) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "2rem",
        backgroundColor: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "0.25rem",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("svg", {
      style: {
        width: "3rem",
        height: "3rem",
        color: "#f97316",
        marginBottom: "0.75rem"
      },
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24"
    }, /*#__PURE__*/React.createElement("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: "2",
      d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    })), /*#__PURE__*/React.createElement("p", {
      style: {
        color: "#374151",
        fontWeight: "500",
        margin: "0 0 0.25rem 0"
      }
    }, "Complex PowerPoint File"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: "0.875rem",
        color: "#6b7280",
        margin: "0 0 1rem 0"
      }
    }, "Unable to preview slides inline."), fallbackUrl && /*#__PURE__*/React.createElement("a", {
      href: fallbackUrl,
      download: fileName,
      style: {
        backgroundColor: "#dbeafe",
        color: "#1d4ed8",
        padding: "0.5rem 1rem",
        borderRadius: "0.25rem",
        fontWeight: "500",
        textDecoration: "none"
      }
    }, "Extract to view in PowerPoint"));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      minHeight: "450px",
      padding: "1.5rem",
      backgroundColor: "#2a2d32",
      border: "1px solid #e5e7eb",
      borderRadius: "0.375rem",
      boxSizing: "border-box",
      position: "relative",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center"
    }
  }, loading && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#2a2d32",
      color: "#fff",
      zIndex: 10,
      borderRadius: "0.375rem"
    }
  }, "Loading Presentation..."), /*#__PURE__*/React.createElement("style", null, `
          .forced-full-width {
            width: 100% !important;
            height: auto !important;
          }
        `), /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: "960px",
      // The slides will safely scale up to this width
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      opacity: loading ? 0 : 1,
      transition: "opacity 0.3s ease"
    }
  }, /*#__PURE__*/React.createElement("canvas", {
    ref: canvasRef,
    className: "forced-full-width",
    style: {
      display: "block",
      backgroundColor: "#fff",
      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4)",
      borderRadius: "4px"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      gap: "1rem",
      marginTop: "1.25rem",
      opacity: loading ? 0 : 1,
      pointerEvents: loading ? "none" : "auto"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: handlePrevSlide,
    style: {
      padding: "0.5rem 1.25rem",
      cursor: "pointer",
      borderRadius: "4px",
      border: "1px solid #4b5563",
      backgroundColor: "#374151",
      color: "white",
      fontWeight: "500"
    }
  }, "← Previous Slide"), /*#__PURE__*/React.createElement("button", {
    onClick: handleNextSlide,
    style: {
      padding: "0.5rem 1.25rem",
      cursor: "pointer",
      borderRadius: "4px",
      border: "1px solid #4b5563",
      backgroundColor: "#374151",
      color: "white",
      fontWeight: "500"
    }
  }, "Next Slide →")));
}
/**
 * Modified CanvasLMS source code to create a similar looking score distribution graph (boxplot)
 * @param {Object} assignment - The assignment to create a score distribution graph for. Must contain score_statistics.
 * @returns {JSX.Element} The score distribution graph.
 */
const ScoreDistributionGraph = ({
  assignment
}) => {
  // Constants based on Canvas LMS SVG coordinate system
  const GRAPH_SCALAR = 150.0;
  const GRAY_COLOR = "#4A5B68";
  const BLUE_COLOR = "#224488";
  const BLUE_FILL_COLOR = "#aabbdd";

  // Safety fallbacks for score scaling
  const pointsPossible = assignment?.points_possible || 10;
  const scaleStatValue = stat => {
    if (stat === undefined || stat === null || isNaN(stat)) return 0;
    return Number(stat) / pointsPossible * GRAPH_SCALAR;
  };

  // Extract values directly from your JSON format
  const userScore = assignment?.submission?.score;
  const stats = assignment?.score_statistics || {};
  const graph = {
    title: `Score Distribution Graph - ${assignment?.name || ""}`,
    max_pos: GRAPH_SCALAR,
    low_pos: scaleStatValue(stats.min),
    lq_pos: scaleStatValue(stats.lower_q),
    uq_pos: scaleStatValue(stats.upper_q),
    high_pos: scaleStatValue(stats.max),
    median_pos: scaleStatValue(stats.median),
    score_pos: scaleStatValue(userScore)
  };

  // SVG Geometry Dimensions
  const zeroPosition = "0";
  const maxSvgHeight = "27";
  const minSvgHeight = "3";
  const displaySvgHeight = "24";
  const startSvgHeight = "6";
  const strokeWidthDefault = "2";
  const midSvgHeight = "15";
  const myScoreBoxHeight = "14";
  const myScoreBoxStartPos = "8";
  const viewBoxValues = "-1 0 160 30";
  const createSvgLine = (className, x1, y1, x2, y2, strokeWidth = strokeWidthDefault) => ({
    className,
    x1,
    y1,
    x2,
    y2,
    strokeWidth
  });
  const svgLines = [createSvgLine("zero", zeroPosition, minSvgHeight, zeroPosition, maxSvgHeight), createSvgLine("possible", `${graph.max_pos}`, minSvgHeight, `${graph.max_pos}`, maxSvgHeight), createSvgLine("min", `${graph.low_pos}`, startSvgHeight, `${graph.low_pos}`, displaySvgHeight), createSvgLine("bottomQ", `${graph.low_pos}`, midSvgHeight, `${graph.lq_pos}`, midSvgHeight), createSvgLine("topQ", `${graph.uq_pos}`, midSvgHeight, `${graph.high_pos}`, midSvgHeight), createSvgLine("max", `${graph.high_pos}`, startSvgHeight, `${graph.high_pos}`, displaySvgHeight), createSvgLine("median", `${graph.median_pos}`, minSvgHeight, `${graph.median_pos}`, maxSvgHeight)];
  const mid50Rect = {
    className: "mid50",
    x: `${graph.lq_pos}`,
    y: minSvgHeight,
    width: `${Math.max(0, graph.uq_pos - graph.lq_pos)}`,
    height: displaySvgHeight,
    strokeWidth: strokeWidthDefault,
    rx: minSvgHeight,
    fill: "none"
  };
  const myScoreRect = {
    x: `${graph.score_pos - 7}`,
    y: myScoreBoxStartPos,
    width: myScoreBoxHeight,
    height: myScoreBoxHeight,
    strokeWidth: strokeWidthDefault,
    rx: minSvgHeight,
    fill: BLUE_FILL_COLOR
  };
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: viewBoxValues,
    xmlns: "http://www.w3.org/2000/svg",
    style: {
      cursor: "pointer",
      float: "right",
      height: "30px",
      width: "161px",
      position: "relative"
    },
    "aria-hidden": "true",
    "data-testid": "scoreDistributionGraph"
  }, /*#__PURE__*/React.createElement("title", null, graph.title), svgLines.map(lineInstructions => /*#__PURE__*/React.createElement("line", {
    key: lineInstructions.className,
    ...lineInstructions,
    stroke: GRAY_COLOR
  })), /*#__PURE__*/React.createElement("rect", {
    ...mid50Rect,
    stroke: GRAY_COLOR
  }), userScore !== undefined && userScore !== null && /*#__PURE__*/React.createElement("rect", {
    className: "myScore",
    ...myScoreRect,
    stroke: BLUE_COLOR
  }, /*#__PURE__*/React.createElement("title", null, `Your Score: ${userScore} out of ${pointsPossible}`)));
};
/**
 * Top Breadcrumbs component that displays navigation breadcrumbs for the course.
 * @param {Object} props
 * @param {{title: string, callback?: function}[]} props.list
 */
function TopBreadcrumbs({
  list = []
}) {
  const {
    courseData
  } = useCourseContext();
  const {
    navigateToSection
  } = useNavigation();
  if (!courseData) {
    return null;
  }
  const courseTitle = courseData?.manifest?.course;
  return /*#__PURE__*/React.createElement("nav", {
    "aria-label": "breadcrumb"
  }, /*#__PURE__*/React.createElement("ol", {
    className: "top-breadcrumbs"
  }, courseTitle && /*#__PURE__*/React.createElement("li", {
    className: "breadcrumb-item",
    style: {
      cursor: "pointer"
    },
    onClick: () => navigateToSection("frontpage")
  }, courseTitle), Array.isArray(list) && list.map((item, index) => /*#__PURE__*/React.createElement("li", {
    key: item.id || index,
    className: "breadcrumb-item",
    onClick: item.callback,
    style: item.callback ? {
      cursor: "pointer"
    } : undefined
  }, item.title))));
}
/**
 * Simple component to render the selected annoucement.
 * @returns {React.Component} The AnnouncementDetailComponent
 */
function AnnouncementDetailPage() {
  const {
    courseData
  } = useCourseContext();
  const {
    selectedAnnouncementId,
    navigateToAnnouncement
  } = useNavigation();
  if (!courseData) {
    return /*#__PURE__*/React.createElement("div", null, "Loading...");
  }
  const announcement = courseData.Announcements.find(announcement => announcement.id === selectedAnnouncementId);
  if (!announcement) {
    return /*#__PURE__*/React.createElement("div", null, "Announcement not found.");
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "page-div",
    style: {
      marginBottom: "4em"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: "1px solid rgb(39, 53, 64)",
      paddingBottom: "1rem",
      marginBottom: "1rem"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      color: "rgb(39, 53, 64)",
      fontSize: "28.8px"
    }
  }, announcement.title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "0.5rem",
      color: "#636d75"
    }
  }, /*#__PURE__*/React.createElement(NameProfileCard, {
    name: announcement.user_name || announcement.author?.display_name || "Anonymous",
    date: announcement.posted_at,
    includeProfileCircle: true,
    nameStyle: {
      fontWeight: "bold"
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "assignment-link",
    style: {
      fontWeight: "bold",
      color: "black",
      marginRight: "2em",
      border: "1px solid rgb(232, 234, 236)",
      padding: "0.25em",
      borderRadius: "4px",
      backgroundColor: "rgb(242, 244, 244)"
    },
    onClick: () => {
      navigateToAnnouncement(null);
    }
  }, "Back"))), /*#__PURE__*/React.createElement("div", {
    className: "announcement-message",
    style: {
      fontSize: "16px",
      lineHeight: "1.6"
    },
    dangerouslySetInnerHTML: {
      __html: announcement.message
    }
  }));
}
/**
 * Displays all of the announcements in a course. The CSS to get the individual annoucementItems was difficult.
 * @returns {React.Component} AnnouncementsPage component.
 */
function AnnouncementsPage() {
  const {
    courseData,
    reconnectFolder
  } = useCourseContext();
  const {
    navigateToAnnouncement
  } = useNavigation();
  if (!courseData) {
    return /*#__PURE__*/React.createElement("div", null, "Loading...");
  }
  if (!courseData.Announcements) {
    return /*#__PURE__*/React.createElement("div", null, "No announcements available.");
  }
  function removeHTML(htmlString) {
    return htmlString.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ");
  }
  function announcementItem(announcement, index) {
    return /*#__PURE__*/React.createElement("div", {
      key: announcement.id,
      style: {
        borderBottom: "1px solid rgb(39, 53, 64)",
        borderTop: index === 0 ? "1px solid rgb(39, 53, 64)" : "none",
        width: "100%",
        boxSizing: "border-box",
        padding: ".75em",
        gap: "1em",
        // THE FIX: Switch from Flexbox to CSS Grid
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(NameProfileCard, {
      name: announcement?.user_name || announcement?.author?.display_name || "Anonymous",
      date: announcement?.posted_at,
      includeName: false
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("h4", {
      style: {
        marginBottom: "0",
        marginTop: "0",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        color: "rgb(39, 53, 64)"
      },
      className: "assignment-link",
      onClick: () => {
        console.log("announcement.id", announcement.id);
        reconnectFolder();
        navigateToAnnouncement(announcement.id);
      }
    }, announcement?.title), /*#__PURE__*/React.createElement("div", {
      className: "announcement-message",
      style: {
        fontSize: "14px",
        color: "#636d75",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, removeHTML(announcement?.message || ""))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(NameProfileCard, {
      name: announcement?.user_name || announcement?.author?.display_name || "Anonymous",
      date: announcement?.posted_at,
      includeProfileCircle: false,
      nameStyle: {
        textAlign: "right"
      }
    })));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "page-div",
    style: {
      marginBottom: "4em"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      color: "#666666",
      fontSize: 28.8
    }
  }, "Announcements"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%"
    }
  }, courseData.Announcements.map((announcement, index) => announcementItem(announcement, index))));
}
// Inner component that safely consumes the Context
function AppContent() {
  const {
    courseData,
    clearCourseData
  } = useCourseContext();
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("nav", {
    id: "sidebar_nav"
  }, /*#__PURE__*/React.createElement("div", {
    className: "side_navigation_item",
    style: {
      height: "85px"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "data:image/png;base64,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",
    alt: "",
    width: "48",
    height: "48"
  })), /*#__PURE__*/React.createElement("div", {
    className: "side_navigation_item"
  }, /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "ic-nav",
    version: "1.1",
    x: "0",
    y: "0",
    viewBox: "0 0 280 200",
    enableBackground: "new 0 0 280 200"
    //   xml:space="preserve"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M273.09,180.75H197.47V164.47h62.62A122.16,122.16,0,1,0,17.85,142a124,124,0,0,0,2,22.51H90.18v16.29H6.89l-1.5-6.22A138.51,138.51,0,0,1,1.57,142C1.57,65.64,63.67,3.53,140,3.53S278.43,65.64,278.43,142a137.67,137.67,0,0,1-3.84,32.57ZM66.49,87.63,50.24,71.38,61.75,59.86,78,76.12Zm147,0L202,76.12l16.25-16.25,11.51,11.51ZM131.85,53.82v-23h16.29v23Zm15.63,142.3a31.71,31.71,0,0,1-28-16.81c-6.4-12.08-15.73-72.29-17.54-84.25a8.15,8.15,0,0,1,13.58-7.2c8.88,8.21,53.48,49.72,59.88,61.81a31.61,31.61,0,0,1-27.9,46.45ZM121.81,116.2c4.17,24.56,9.23,50.21,12,55.49A15.35,15.35,0,1,0,161,157.3C158.18,152,139.79,133.44,121.81,116.2Z"
  })), "Dashboard"), /*#__PURE__*/React.createElement("div", {
    className: "side_navigation_item"
  }, /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "ic-nav",
    version: "1.1",
    x: "0",
    y: "0",
    viewBox: "0 0 280 200",
    enableBackground: "new 0 0 280 200"
    //   xml:space="preserve"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M73.31,198c-11.93,0-22.22,8-24,18.73a26.67,26.67,0,0,0-.3,3.63v.3a22,22,0,0,0,5.44,14.65,22.47,22.47,0,0,0,17.22,8H200V228.19h-134V213.08H200V198Zm21-105.74h90.64V62H94.3ZM79.19,107.34V46.92H200v60.42Zm7.55,30.21V122.45H192.49v15.11ZM71.65,16.71A22.72,22.72,0,0,0,49,39.36V190.88a41.12,41.12,0,0,1,24.32-8h157V16.71ZM33.88,39.36A37.78,37.78,0,0,1,71.65,1.6H245.36V198H215.15v45.32h22.66V258.4H71.65a37.85,37.85,0,0,1-37.76-37.76Z"
  })), "Courses"), /*#__PURE__*/React.createElement("div", {
    className: "side_navigation_item"
  }, /*#__PURE__*/React.createElement("svg", {
    fill: "white",
    height: "24px",
    viewBox: "0 0 1920 1920",
    xmlns: "http://www.w3.org/2000/svg",
    style: {
      marginBottom: "4px"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "m1739.34 1293.414-105.827 180.818-240.225-80.188-24.509 22.25c-69.91 63.586-150.211 109.666-238.644 136.771l-32.076 9.94-49.468 244.065H835.584l-49.468-244.179-32.076-9.939c-88.432-27.105-168.734-73.185-238.644-136.771l-24.508-22.25-240.226 80.189-105.826-180.82 189.74-164.442-7.453-32.978c-10.39-45.742-15.586-91.483-15.586-135.869 0-44.386 5.195-90.127 15.586-135.868l7.454-32.979-189.741-164.442 105.826-180.819 240.226 80.075 24.508-22.25c69.91-63.585 150.212-109.665 238.644-136.884l32.076-9.826 49.468-244.066h213.007l49.468 244.18 32.076 9.825c88.433 27.219 168.734 73.186 238.644 136.885l24.509 22.25 240.225-80.189 105.826 180.819-189.74 164.442 7.453 32.98c10.39 45.74 15.586 91.481 15.586 135.867 0 44.386-5.195 90.127-15.586 135.869l-7.454 32.978 189.741 164.556Zm-53.76-333.403c0-41.788-3.84-84.48-11.634-127.284l210.184-182.062-199.454-340.856-265.186 88.433c-66.974-55.567-143.322-99.388-223.85-128.414L1140.977.01H743.198l-54.663 269.704c-81.431 29.139-156.424 72.282-223.963 128.414L199.5 309.809.045 650.665l210.07 182.062c-7.68 42.804-11.52 85.496-11.52 127.284 0 41.789 3.84 84.48 11.52 127.172L.046 1269.357 199.5 1610.214l265.186-88.546c66.974 55.68 143.323 99.388 223.85 128.527l54.663 269.816h397.779l54.663-269.703c81.318-29.252 156.424-72.283 223.85-128.527l265.186 88.546 199.454-340.857-210.184-182.174c7.793-42.805 11.633-85.496 11.633-127.285ZM942.075 564.706C724.1 564.706 546.782 742.024 546.782 960c0 217.976 177.318 395.294 395.294 395.294 217.977 0 395.294-177.318 395.294-395.294 0-217.976-177.317-395.294-395.294-395.294m0 677.647c-155.633 0-282.353-126.72-282.353-282.353s126.72-282.353 282.353-282.353S1224.43 804.367 1224.43 960s-126.72 282.353-282.353 282.353",
    fillRule: "evenodd"
  })), "Settings"), /*#__PURE__*/React.createElement("div", {
    className: "side_navigation_item",
    onClick: () => clearCourseData()
  }, /*#__PURE__*/React.createElement("svg", {
    fill: "white",
    height: "24px",
    viewBox: "0 0 1920 1920",
    xmlns: "http://www.w3.org/2000/svg",
    style: {
      marginBottom: "4px"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M960 0v112.941c467.125 0 847.059 379.934 847.059 847.059 0 467.125-379.934 847.059-847.059 847.059-467.125 0-847.059-379.934-847.059-847.059 0-267.106 126.607-515.915 338.824-675.727v393.374h112.94V112.941H0v112.941h342.89C127.058 407.38 0 674.711 0 960c0 529.355 430.645 960 960 960s960-430.645 960-960S1489.355 0 960 0",
    fillRule: "evenodd"
  })), "Reset")), /*#__PURE__*/React.createElement("div", {
    className: "nav_spacer",
    style: {
      minWidth: "85px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    id: "main-content",
    style: {
      alignItems: !courseData ? "center" : "inherit"
    }
  }, courseData !== null ? /*#__PURE__*/React.createElement(MainContent, null) : /*#__PURE__*/React.createElement(CoursePicker, null)));
}

// Outer provider wrapper
function OfflineApp() {
  return /*#__PURE__*/React.createElement(CourseContextProvider, null, /*#__PURE__*/React.createElement(NavigationProvider, null, /*#__PURE__*/React.createElement(AppContent, null)));
}
const container = document.getElementById("root");
const root = ReactDOM.createRoot(container);
root.render(/*#__PURE__*/React.createElement(OfflineApp, null));
/**
 * Renders the per assignment details, allowing users to see the description and their submission.
 * @param {Object} assignment - The assignment to render.
 * @returns {JSX.Element|null} The assignment detail view.
 */
function AssignmentDetailView({
  assignment
}) {
  if (!assignment) {
    return /*#__PURE__*/React.createElement("h1", null, "No Assignment Selected");
  }
  // date must be in format Sat Jun 3, 2023 12:50pm
  // assignment?.due_at is in format 2023-06-03T19:50:15-04:00
  function customDateFormat(date) {
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.toLocaleDateString("en-US", {
      weekday: "short"
    });
    const month = dateObj.toLocaleDateString("en-US", {
      month: "short"
    });
    const day = dateObj.toLocaleDateString("en-US", {
      day: "numeric"
    });
    const year = dateObj.toLocaleDateString("en-US", {
      year: "numeric"
    });
    const time = dateObj.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "numeric"
    });
    return `${dayOfWeek} ${month} ${day}, ${year} ${time}`;
  }
  function pointsDisplay(assignment) {
    if (assignment?.grading_type == "points") {
      return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("strong", null, assignment?.submission?.score || (assignment?.submission?.missing ? "0" : "-"), "/", assignment?.points_possible), " Points");
    }
    if (assignment?.grading_type == "not_graded") {
      return /*#__PURE__*/React.createElement(React.Fragment, null);
    }
    if (assignment?.grading_type == "pass_fail") {
      return /*#__PURE__*/React.createElement(React.Fragment, null, assignment?.submission?.grade == "complete" ? "Complete" : "Incomplete");
    }
    return /*#__PURE__*/React.createElement(React.Fragment, null, "error");
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      marginBottom: "8em"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "assignment-student-header"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "assignment-student-header-title"
  }, assignment?.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "14px",
      fontWeight: "bold"
    }
  }, "Due: ", assignment?.due_at ? customDateFormat(assignment?.due_at) : "Not Set")), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: "0.5em"
    }
  }, /*#__PURE__*/React.createElement("span", null, assignment.submission?.late && !assignment.submission?.missing && /*#__PURE__*/React.createElement(ContextPill, {
    type: "late"
  }), assignment.submission?.missing && /*#__PURE__*/React.createElement(ContextPill, {
    type: "missing"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "1.5em",
      textAlign: "right"
    }
  }, pointsDisplay(assignment)))), /*#__PURE__*/React.createElement("div", {
    className: "assignment-information",
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "left",
      padding: "1em"
    }
  }, typeof assignment?.lock_explanation === "string" && /*#__PURE__*/React.createElement("span", null, assignment.lock_explanation)), /*#__PURE__*/React.createElement("div", {
    className: "assignment-details",
    dangerouslySetInnerHTML: {
      __html: assignment?.description
    }
  }), /*#__PURE__*/React.createElement(AssignmentRubric, {
    rubric: assignment?.rubric
  }), assignment?.submission?.attachments && /*#__PURE__*/React.createElement(CanvasSubmission, {
    assignment: assignment
  }));
}
/**
 * Main function that renders the assignments page.
 * @returns The main Assignments page component for the viewer.
 */

function AssignmentsPage() {
  const {
    courseData
  } = useCourseContext();
  if (!courseData) {
    return /*#__PURE__*/React.createElement("div", null, "Loading...");
  }
  if (!courseData.Assignments) {
    return /*#__PURE__*/React.createElement("div", null, "No assignments available.");
  }
  // Convert dictionary object or array into a flat array of assignments
  const assignmentList = Array.isArray(courseData.Assignments) ? courseData.Assignments : Object.values(courseData.Assignments);
  // sort assignments by reverse due date order
  assignmentList.sort((a, b) => {
    return new Date(b.due_at) - new Date(a.due_at);
  });
  if (courseData.Assignments) {
    return /*#__PURE__*/React.createElement("div", {
      className: "page-div",
      style: {
        marginBottom: "4em"
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        color: "#666666",
        fontSize: 28.8
      }
    }, "Assignments"), /*#__PURE__*/React.createElement(CollapseTable, {
      title: "Assignments"
    }, assignmentList.map((assignment, index) => /*#__PURE__*/React.createElement(CollapseListItemDetails, {
      key: assignment.id,
      closed: assignment?.availability_status?.status || "Unknown" // Uses 'availability_status.status' from Canvas JSON
      ,
      title: assignment?.name || "No Title" // Uses 'name' from Canvas JSON
      ,
      dueDate: assignment?.due_at ? fixDateFormat(assignment?.due_at) : "No Due Date",
      grade: assignment?.submission?.score || "-",
      maxGrade: assignment?.points_possible // Uses 'points_possible' from Canvas JSON
      ,
      assignment: assignment,
      type: "assignment"
    }))));
  }
}
/**
 * Displays a threadded view of the currently selected discussion
 * @param {number} discussionId - The ID of the discussion to display.
 * @returns A React component that displays a threadded view of the currently selected discussion.
 */
function DiscussionDetailView({
  discussionId
}) {
  const {
    courseData
  } = useCourseContext();
  if (!courseData) {
    return /*#__PURE__*/React.createElement("div", null, "Loading...");
  }
  if (!courseData.Discussions) {
    return /*#__PURE__*/React.createElement("div", null, "No discussions available.");
  }
  const discussion = courseData.Discussions[discussionId];
  function renderDiscussionBody() {
    const view = discussion?.view?.view; // List of all replies
    const participants = discussion?.view?.participants; // List of all participants
    if (!view) {
      return /*#__PURE__*/React.createElement("div", null, "No discussion body available.");
    }
    if (!participants) {
      return /*#__PURE__*/React.createElement("div", null, "No participants available.");
    }
    return view.map(reply => {
      const [repliesHidden, setHidden] = useState(true);
      if (reply?.deleted) {
        return "";
      }
      return /*#__PURE__*/React.createElement("div", {
        key: reply.id,
        style: {
          border: "1px solid rgb(235, 236, 237)",
          borderRadius: "4px",
          padding: "1em",
          marginTop: "1em",
          flexDirection: "column"
        }
      }, /*#__PURE__*/React.createElement(NameProfileCard, {
        name: participants.find(participant => participant.id === reply?.user_id)?.display_name || "Unknown",
        date: reply.created_at
      }), /*#__PURE__*/React.createElement("div", {
        className: "discussion-description",
        style: {
          marginBottom: "0em",
          maxWidth: "100%"
        },
        dangerouslySetInnerHTML: {
          __html: reply?.message
        }
      }), reply?.replies && reply?.replies?.length > 0 && /*#__PURE__*/React.createElement("a", {
        onClick: () => {
          setHidden(!repliesHidden);
        },
        className: "assignment-link",
        style: {
          display: "flex",
          alignItems: "center",
          gap: "5px"
        }
      }, repliesHidden ? "Show Replies " : "Hide Replies", /*#__PURE__*/React.createElement("svg", {
        style: {
          height: "15px",
          width: "15px",
          fill: "rgb(14, 104, 179)",
          transform: repliesHidden ? "rotate(0deg)" : "rotate(90deg)"
        },
        viewBox: "0 0 1920 1920",
        xmlns: "http://www.w3.org/2000/svg"
      }, /*#__PURE__*/React.createElement("path", {
        d: "M526.299 0 434 92.168l867.636 867.767L434 1827.57l92.299 92.43 959.935-960.065z",
        fill: "currentColor"
      }))), !repliesHidden && reply?.replies?.map(reply => {
        if (reply?.deleted) {
          return "";
        }
        return /*#__PURE__*/React.createElement("div", {
          key: reply.id,
          style: {
            border: "1px solid rgb(235, 236, 237)",
            borderRadius: "4px",
            padding: "1em",
            marginTop: "1em",
            flexDirection: "column"
          }
        }, /*#__PURE__*/React.createElement(NameProfileCard, {
          name: participants.find(participant => participant.id === reply?.user_id)?.display_name || "Unknown",
          date: reply.created_at
        }), /*#__PURE__*/React.createElement("div", {
          className: "discussion-description",
          style: {
            marginBottom: "0em",
            maxWidth: "100%"
          },
          dangerouslySetInnerHTML: {
            __html: reply?.message
          }
        }));
      }));
    });
  }
  console.log("Rendering Discussion ID: ", discussionId);
  return /*#__PURE__*/React.createElement("div", {
    className: "page-div",
    style: {
      marginBottom: "4em"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "discussion-header",
    style: {
      display: "flex",
      alignItems: "left",
      marginBottom: "1rem",
      border: "1px solid rgb(235, 236, 237)",
      borderRadius: "4px",
      padding: "1em",
      marginTop: "2em",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      color: "rgb(39, 53, 64)",
      marginBottom: "1em"
    }
  }, /*#__PURE__*/React.createElement("span", null, "Due ", fixDateFormat(discussion?.assignment?.due_at) || "Never"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "14px"
    }
  }, discussion?.assignment?.points_possible || "0", " Points Possible")), /*#__PURE__*/React.createElement(NameProfileCard, {
    name: discussion?.author?.display_name || "Anonnymous",
    date: discussion?.delayed_post_at || discussion?.created_at || discussion?.last_reply_at || discussion?.posted_at
  }), /*#__PURE__*/React.createElement("h2", {
    style: {
      color: "rgb(39, 53, 64)",
      fontSize: "28.8px",
      marginBottom: "0em"
    }
  }, discussion?.title), /*#__PURE__*/React.createElement("div", {
    className: "discussion-description",
    dangerouslySetInnerHTML: {
      __html: discussion?.message || "No discription provided."
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "discussion-body",
    style: {
      display: "flex",
      alignItems: "left",
      marginBottom: "1rem",
      padding: "1em",
      marginTop: "2em",
      flexDirection: "column"
    }
  }, renderDiscussionBody()));
}
/**
 * Creates the discussions page, which lists all the discussions in a course.
 * @returns {React.Component} the discussions page
 */

function DiscussionsPage() {
  const {
    courseData,
    reconnectFolder
  } = useCourseContext();
  const {
    navigateToDiscussion
  } = useNavigation();
  if (!courseData) {
    return /*#__PURE__*/React.createElement("div", null, "Loading...");
  }
  if (!courseData.Discussions || Object.keys(courseData?.Discussions || {}).length === 0) {
    return /*#__PURE__*/React.createElement("div", null, "No discussions available.");
  }
  // Convert dictionary object or array into a flat array of assignments
  const discussionList = Array.isArray(courseData.Discussions) ? courseData.Discussions : Object.values(courseData.Discussions);
  // sort discussions by reverse due date order
  discussionList.sort((a, b) => {
    return new Date(b.due_at) - new Date(a.due_at);
  });
  function DiscussionTableItemDetails({
    discussion
  }) {
    const indent = 0;
    return /*#__PURE__*/React.createElement("div", {
      className: "assignment-details",
      style: {
        display: "flex",
        alignItems: "center",
        paddingLeft: `${indent * 1}em`,
        justifyContent: "space-between",
        width: "100%"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement(CanvasItemIcon, {
      icon_type: "discussion"
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
      className: "assignment-info-title",
      style: {
        fontSize: "16px",
        margin: "0",
        color: "#273450",
        cursor: "pointer"
      },
      onClick: () => {
        reconnectFolder();
        if (discussion?.id) {
          navigateToDiscussion(discussion.id);
        }
      }
    }, discussion.title), /*#__PURE__*/React.createElement("span", {
      className: "assignment-info-item",
      style: {
        color: "#666666",
        fontSize: 14,
        marginLeft: "0em"
      }
    }, /*#__PURE__*/React.createElement("strong", null, "Last post at ", discussion?.last_reply_at ? fixDateFormat(discussion?.last_reply_at) : "-")))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-end",
        flexDirection: "column",
        marginLeft: "2em",
        textAlign: "right",
        justifyContent: "right"
      }
    }, discussion?.view && /*#__PURE__*/React.createElement("h3", {
      className: "",
      style: {
        fontSize: "16px",
        fontWeight: "normal",
        margin: "0",
        color: "#273450",
        cursor: "default"
      }
    }, discussion?.view?.view?.length || "0", " Replies"), discussion?.assignment && /*#__PURE__*/React.createElement("h3", {
      className: "",
      style: {
        fontSize: "16px",
        fontWeight: "normal",
        margin: "0",
        color: "#273450",
        cursor: "default"
      }
    }, "Due ", fixDateFormat(discussion?.assignment?.due_at))));
  }
  if (courseData.Discussions) {
    return /*#__PURE__*/React.createElement("div", {
      className: "page-div",
      style: {
        marginBottom: "4em"
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        color: "#666666",
        fontSize: 28.8
      }
    }, "Discussions"), /*#__PURE__*/React.createElement(CollapseTable, {
      title: "Discussions"
    }, discussionList.map((discussion, index) => /*#__PURE__*/React.createElement(DiscussionTableItemDetails, {
      discussion: discussion,
      key: discussion.id
    }))));
  }
}
/**
 * Displays the list of files. This page has to handle parent folders, and files inside those parent folders.
 * @returns {React.Component} The files page
 */

function FilesPage() {
  const {
    courseData,
    reconnectFolder
  } = useCourseContext();
  const {
    navigateToPage
  } = useNavigation();
  const [selectedFile, setSelectedFile] = useState(null);
  if (!courseData) {
    return /*#__PURE__*/React.createElement("div", null, "Loading...");
  }
  if (!courseData?.Files || courseData?.Files?.files?.length === 0 && courseData?.Files?.folders?.length === 0) {
    return /*#__PURE__*/React.createElement("div", null, "No files available.");
  }
  // Find the ID of the main folder
  const rootFolder = courseData.Files.folders.find(folder => folder.parent_folder_id === null);
  const [activeFolder, setActiveFolder] = useState(rootFolder ? rootFolder.id : null);

  // Build unified list of files and folders, sorted by display name
  const filesArray = Array.isArray(courseData.Files.files) ? courseData.Files.files : Object.values(courseData.Files.files);
  const foldersArray = Array.isArray(courseData.Files.folders) ? courseData.Files.folders : Object.values(courseData.Files.folders);
  const combinedList = [...filesArray, ...foldersArray].map(item => {
    if (item.display_name) {
      return {
        ...item,
        _type: "file"
      };
    } else if (item.name) {
      return {
        ...item,
        _type: "folder",
        display_name: item.name
      };
    }
    return {
      ...item,
      _type: "unknown"
    };
  }).sort((a, b) => (a.display_name || "").localeCompare(b.display_name || ""));

  // Filter the combined list by activeFolder
  const filteredList = combinedList.filter(item => item.parent_folder_id === activeFolder || item.folder_id === activeFolder);
  if (selectedFile) {
    return /*#__PURE__*/React.createElement(FilesPageDetailView, {
      file: selectedFile,
      onBack: () => setSelectedFile(null)
    });
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      marginBottom: "8em"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      color: "#666666",
      fontSize: 28.8
    }
  }, "Files & Folders"), activeFolder !== rootFolder?.id && /*#__PURE__*/React.createElement("span", {
    className: "assignment-link",
    style: {
      fontWeight: "bold",
      color: "black",
      marginRight: "2em",
      border: "1px solid rgb(232, 234, 236)",
      padding: "0.25em",
      borderRadius: "4px",
      backgroundColor: "rgb(242, 244, 244)"
    },
    onClick: () => {
      setActiveFolder(foldersArray.find(folder => folder.id === activeFolder)?.parent_folder_id || rootFolder || null);
    }
  }, "Back")), /*#__PURE__*/React.createElement("div", {
    className: "pages-container",
    style: {
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "pages-table",
    style: {
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      borderBottom: "2px solid rgb(39, 53, 64)"
    }
  }, /*#__PURE__*/React.createElement("th", {
    style: {
      minWidth: "fit-content",
      whiteSpace: "nowrap"
    }
  }, "Title"), /*#__PURE__*/React.createElement("th", {
    style: {
      minWidth: "fit-content",
      whiteSpace: "nowrap"
    }
  }, "Type"), /*#__PURE__*/React.createElement("th", {
    style: {
      minWidth: "fit-content",
      whiteSpace: "nowrap"
    }
  }, "Creation Date"), /*#__PURE__*/React.createElement("th", {
    style: {
      minWidth: "fit-content",
      whiteSpace: "nowrap"
    }
  }, "Updated at"))), /*#__PURE__*/React.createElement("tbody", null, filteredList.map((item, index) => /*#__PURE__*/React.createElement("tr", {
    key: item.id || index,
    style: {
      backgroundColor: index % 2 === 0 ? "#f2f4f4" : "white"
    }
  }, /*#__PURE__*/React.createElement("td", null, item._type === "folder" ? /*#__PURE__*/React.createElement("a", {
    className: "assignment-link",
    style: {
      fontWeight: "bold",
      color: "black"
    },
    onClick: e => {
      e.preventDefault();
      reconnectFolder();
      setActiveFolder(item.id);
      setSelectedFile(null);
    }
  }, item.display_name) : /*#__PURE__*/React.createElement("a", {
    className: "assignment-link",
    onClick: e => {
      e.preventDefault();
      reconnectFolder();
      setSelectedFile(item);
    }
  }, item.display_name)), /*#__PURE__*/React.createElement("td", null, item._type === "folder" ? "folder" : item["content-type"]), /*#__PURE__*/React.createElement("td", {
    style: {
      minWidth: "fit-content",
      whiteSpace: "nowrap"
    }
  }, item.created_at ? new Date(item.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }) : "-"), /*#__PURE__*/React.createElement("td", {
    style: {
      minWidth: "fit-content",
      whiteSpace: "nowrap"
    }
  }, item.updated_at ? new Date(item.updated_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }) : "-"))), filteredList.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 4
  }, "No files in this folder,", " ", /*#__PURE__*/React.createElement("a", {
    className: "assignment-link",
    onClick: () => setActiveFolder(foldersArray.find(folder => folder.id === activeFolder)?.parent_folder_id || rootFolder || null)
  }, "Back")))))));
}
/**
 * The detail view for a file. It displays the file's information and the file itself. Utilizes the LocalAtatchment Viewer which was created for submission viewing.
 * @param {*} file - The file to display.
 * @param {*} onBack - The function to call when the back button is clicked.
 * @returns {React.Component} The files page detail view
 */
function FilesPageDetailView({
  file,
  onBack
}) {
  if (!file) {
    return /*#__PURE__*/React.createElement("h1", null, "No File Selected");
  }
  const formattedCreated = file.created_at ? new Date(file.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }) : "-";
  const formattedUpdated = file.updated_at ? new Date(file.updated_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }) : "-";
  const formattedSize = file.size ? (file.size / 1024).toFixed(1) + " KB" : "-";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      marginBottom: "8em",
      marginTop: "1em"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "1rem"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      color: "#666666",
      fontSize: 24,
      margin: 0
    }
  }, file.display_name || file.filename), /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      background: "#00842c",
      color: "#fff",
      border: "none",
      borderRadius: "4px",
      padding: "6px 12px",
      cursor: "pointer"
    }
  }, "Back")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: "1.5rem",
      backgroundColor: "#f9fafb",
      padding: "1rem",
      borderRadius: "0.5rem",
      border: "1px solid #e5e7eb"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0.25rem 0"
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Type:"), " ", file["content-type"] || file.mime_class || "unknown"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0.25rem 0"
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Size:"), " ", formattedSize), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0.25rem 0"
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Created:"), " ", formattedCreated), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0.25rem 0"
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Updated:"), " ", formattedUpdated)), /*#__PURE__*/React.createElement(LocalAttachmentViewer, {
    file: file
  }));
}
/**
 * The grades page displays all of the grades for the course. It includes the ability to sort by due date, name,
 * submitted date, status, and assignment group. It also includes the ability to filter by grading period and to
 * group by assignment group.
 * @returns {React.Component} The grades page.
 */
function GradesPage() {
  const {
    courseData
  } = useCourseContext();
  const {
    useState,
    useMemo
  } = React;
  if (!courseData) {
    return /*#__PURE__*/React.createElement("div", null, "Loading...");
  }
  if (!courseData.Assignments) {
    return /*#__PURE__*/React.createElement("div", null, "No grades available.");
  }

  // Convert dictionary object or array into a flat array of grades
  let gradeList = Array.isArray(courseData.Assignments) ? courseData.Assignments : Object.values(courseData.Assignments);

  // Set the default sorting method for the grades page
  let [sortBy, setSortBy] = useState("due");
  // Set the default grading period to all
  let [selectedGradingPeriod, setSelectedGradingPeriod] = useState("all");
  // Get the grading periods from the course data
  let gradingPeriods = undefined;
  if (courseData?.GradingPeriods?.grading_periods) {
    gradingPeriods = courseData.GradingPeriods.grading_periods;
  }
  // Filter out the assignments that will not be graded grading_type: "not_graded",
  // Filter the active assignments by their grading_period_id
  // and sort by the selected sortBy value
  gradeList = gradeList.filter(assignment => assignment.grading_type !== "not_graded" && (selectedGradingPeriod === "all" || assignment?.submission?.grading_period_id != null && String(assignment.submission.grading_period_id) === String(selectedGradingPeriod))).sort((a, b) => {
    if (sortBy === "due") {
      const aDate = a.due_at ? new Date(a.due_at) : new Date(0);
      const bDate = b.due_at ? new Date(b.due_at) : new Date(0);
      return aDate - bDate;
    } else if (sortBy === "name") {
      return (a.name || "").localeCompare(b.name || "");
    } else if (sortBy === "submitted") {
      const aSub = a.submission?.submitted_at ? new Date(a.submission.submitted_at) : new Date(0);
      const bSub = b.submission?.submitted_at ? new Date(b.submission.submitted_at) : new Date(0);
      return aSub - bSub;
    } else if (sortBy === "status") {
      return (a.submission?.workflow_state || "").localeCompare(b.submission?.workflow_state || "");
    } else if (sortBy === "assignment_group") {
      return (Number(a.assignment_group_id) || 0) - (Number(b.assignment_group_id) || 0);
    }
    return 0;
  });
  let assignmentGroups = undefined;
  if (courseData?.AssignmentGroups) {
    assignmentGroups = courseData.AssignmentGroups;
  }
  let useAssignmentGroupsForWeighting = courseData?.manifest?.useAssignmentGroupsForWeighting || false;

  //Assignment details open/closed state management. Default to all closed.
  const [openStates, setOpenStates] = useState(() => {
    const initial = {};
    gradeList.forEach(m => {
      initial[m.id] = true;
    });
    return initial;
  });
  // Derived state: If AT LEAST ONE detail is open, button action is "Hide All Details".
  // If ALL modules are collapsed (none are open), button action is "Show All Details".
  const isAnyOpen = useMemo(() => {
    return Object.values(openStates).some(isOpen => isOpen === true);
  }, [openStates]);

  // Toggle individual module header click
  const handleToggleModule = id => {
    setOpenStates(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Master button toggle handler
  const handleMasterToggle = () => {
    const nextState = !isAnyOpen; // If any open -> hide all details (false); if all closed -> show all details (true)
    const updated = {};
    gradeList.forEach(m => {
      updated[m.id] = nextState;
    });
    setOpenStates(updated);
  };
  const handleItemType = item => {
    if (!item || !item.type) return "assignment"; // Default to assignment if type is missing
    if (item?.quiz_lti && item?.quiz_lti == true) {
      return "quiz";
    }
    return item.type.toLowerCase(); // Return the type in lowercase for consistency
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "page-div",
    style: {
      marginBottom: "4em"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      color: "#666666",
      fontSize: 28.8
    }
  }, "Grades"), /*#__PURE__*/React.createElement("button", {
    onClick: handleMasterToggle,
    style: {
      backgroundColor: "#f2f4f4",
      border: "1px solid #e8eaec",
      padding: "8px 14px 8px 14px",
      borderRadius: "3px",
      cursor: "pointer",
      fontSize: "16px",
      color: "#273540"
    }
  }, !isAnyOpen ? "Hide All Details" : "Show All Details")), /*#__PURE__*/React.createElement("div", {
    className: "grades-sorting",
    style: {
      marginBottom: ".5em",
      marginTop: ".5em",
      display: "flex",
      flexDirection: "row",
      justifyContent: "left"
    }
  }, gradingPeriods && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      flexDirection: "column",
      justifyContent: "left",
      gap: "0.5em",
      fontSize: "1em",
      marginRight: "2em"
    }
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "grading_period"
  }, /*#__PURE__*/React.createElement("strong", null, "Grading Period")), /*#__PURE__*/React.createElement("select", {
    name: "grading_period",
    id: "grading_period",
    className: "dropdown-select",
    onChange: e => setSelectedGradingPeriod(e.target.value),
    value: selectedGradingPeriod
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "All Grading Periods"), gradingPeriods.map(period => /*#__PURE__*/React.createElement("option", {
    key: period.id,
    value: period.id
  }, period.title || period.display_name)))), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      flexDirection: "column",
      justifyContent: "left",
      gap: "0.5em",
      fontSize: "1em"
    }
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "grades-sorting-dropdown"
  }, /*#__PURE__*/React.createElement("strong", null, "Arrange By")), /*#__PURE__*/React.createElement("select", {
    id: "grades-sorting-dropdown",
    className: "dropdown-select",
    onChange: e => setSortBy(e.target.value),
    value: sortBy
  }, /*#__PURE__*/React.createElement("option", {
    value: "due"
  }, "Due Date"), /*#__PURE__*/React.createElement("option", {
    value: "name"
  }, "Name"), /*#__PURE__*/React.createElement("option", {
    value: "submitted"
  }, "Submitted Date"), /*#__PURE__*/React.createElement("option", {
    value: "assignment_group"
  }, "Assignment Group"))), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      flexGrow: 1,
      justifyContent: "right",
      marginRight: "2em"
    }
  }, "Total:", " ", calculateTotalWeightedGrade(gradeList, useAssignmentGroupsForWeighting ? assignmentGroups : undefined) ? calculateTotalWeightedGrade(gradeList, useAssignmentGroupsForWeighting ? assignmentGroups : undefined)?.toFixed(2) + "%" : "N/A")), /*#__PURE__*/React.createElement("table", {
    className: "grades-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "grades-table-header"
  }, /*#__PURE__*/React.createElement("th", null, "Name"), /*#__PURE__*/React.createElement("th", null, "Due"), /*#__PURE__*/React.createElement("th", null, "Submitted"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null, "Score"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", {
    className: "grades-table-body"
  }, gradeList.map((grade, index) => /*#__PURE__*/React.createElement(GradeTableRow, {
    assignment: grade,
    detailsHidden: openStates[grade.id] ?? true,
    hideDetailCallback: () => handleToggleModule(grade.id),
    assignmentGroups: assignmentGroups,
    key: index
  })), assignmentGroups && assignmentGroups.length > 0 && assignmentGroups.map((group, index) => /*#__PURE__*/React.createElement("tr", {
    className: "grade-row",
    key: index
  }, /*#__PURE__*/React.createElement("td", {
    colSpan: "4"
  }, /*#__PURE__*/React.createElement("strong", null, group.name)), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("strong", null, calculateGradeForGroup(group, gradeList)?.percentage?.toFixed(2) ? calculateGradeForGroup(group, gradeList)?.percentage?.toFixed(2) + "%" : "N/A")), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      whiteSpace: "nowrap"
    }
  }, calculateGradeForGroup(group, gradeList)?.totalPointsEarned?.toFixed(2) || "N/A", " /", " ", calculateGradeForGroup(group, gradeList)?.totalPointsPossible?.toFixed(2) || "N/A")))), /*#__PURE__*/React.createElement("tr", {
    className: "grade-row grade-row-total"
  }, /*#__PURE__*/React.createElement("td", {
    colSpan: "4",
    style: {
      textAlign: "left",
      textWrap: "nowrap"
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Total")), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("strong", null, calculateTotalWeightedGrade(gradeList, useAssignmentGroupsForWeighting ? assignmentGroups : undefined) ? calculateTotalWeightedGrade(gradeList, useAssignmentGroupsForWeighting ? assignmentGroups : undefined)?.toFixed(2) + "%" : "N/A")), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("strong", null, calculateTotalPoints(gradeList)?.totalPointsEarned?.toFixed(2) || "N/A", " /", " ", calculateTotalPoints(gradeList)?.totalPointsPossible?.toFixed(2) || "N/A"))))), /*#__PURE__*/React.createElement("div", {
    className: "group-weighting"
  }, !useAssignmentGroupsForWeighting || !assignmentGroups || assignmentGroups.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "no-weighting-text"
  }, "Course assignments are not weighted.") : /*#__PURE__*/React.createElement("div", {
    className: "weighting-container"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "weighting-title"
  }, "Course Weighting"), /*#__PURE__*/React.createElement("table", {
    className: "weighting-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Group"), /*#__PURE__*/React.createElement("th", null, "Weight"))), /*#__PURE__*/React.createElement("tbody", null, assignmentGroups.map((group, index) => /*#__PURE__*/React.createElement("tr", {
    key: group.id || index
  }, /*#__PURE__*/React.createElement("td", null, group.name), /*#__PURE__*/React.createElement("td", null, group.group_weight !== undefined && group.group_weight !== null ? `${group.group_weight}%` : "N/A"))))))));
}
/**
 * Renders a single table row for the grade table
 * @param {Object} props
 * @param {Object} props.assignment - The assignment to render
 * @param {boolean} props.detailsHidden - Whether the details are hidden
 * @param {Function} props.hideDetailCallback - The callback to hide the details
 * @param {Array<Object>} props.assignmentGroups - The assignment groups
 * @returns a single table row for the grade table
 */
function GradeTableRow({
  assignment,
  detailsHidden,
  hideDetailCallback,
  assignmentGroups
}) {
  const {
    navigateToAssignment
  } = useNavigation();
  const {
    reconnectFolder
  } = useCourseContext();
  let assignmentGroupName = "Unknown Assignment Group";
  if (assignmentGroups && assignmentGroups.length > 0) {
    // takes a list of assignment groups and finds the name of the group that matches the assignment's group ID
    assignmentGroupName = assignmentGroups.filter(group => group.id === assignment.assignment_group_id)[0]?.name || "Unknown Assignment Group";
  }
  let checkmark = /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 1920 1920",
    xmlns: "http://www.w3.org/2000/svg",
    style: {
      height: "16px",
      width: "16px"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1827.701 303.065 698.835 1431.801 92.299 825.266 0 917.564 698.835 1616.4 1919.869 395.234z"
  }));
  let xmark = /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 1920 1920",
    xmlns: "http://www.w3.org/2000/svg",
    style: {
      height: "16px",
      width: "16px"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M954.64 826.418 426.667 298.445 298.445 426.667 826.418 954.64l-527.973 527.973 128.222 128.222 527.973-527.973 527.973 527.973 128.222-128.222-527.973-527.973 527.973-527.973-128.222-128.222z"
  }));
  const renderGrade = assignment => {
    const {
      grading_type,
      points_possible,
      submission
    } = assignment || {};
    if (grading_type === "points") {
      return `${submission?.score ?? "-"} / ${points_possible ?? "-"}`;
    }
    if (grading_type === "pass_fail") {
      return submission?.grade === "complete" ? checkmark : xmark;
    }
    if (grading_type === "not_graded") {
      return "-";
    }
    if (grading_type == "letter_grade") {
      return `${submission?.score} (${submission?.grade})`;
    }
    return "-";
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("tr", {
    className: "grade-row",
    key: assignment.id
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      maxWidth: "30%"
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "assignment-link",
    onClick: () => {
      reconnectFolder();
      navigateToAssignment(assignment?.id);
    }
  }, assignment.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "14px",
      color: "rgb(39, 53, 64)"
    }
  }, assignmentGroupName)), /*#__PURE__*/React.createElement("td", null, assignment.due_at ? fixDateFormat(assignment.due_at) : ""), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "left"
    }
  }, assignment.submission?.submitted_at ? fixDateFormat(assignment.submission?.submitted_at) : ""), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "center"
    }
  }, assignment.submission?.late && !assignment.submission?.missing && /*#__PURE__*/React.createElement(ContextPill, {
    type: "late"
  }), assignment.submission?.missing && /*#__PURE__*/React.createElement(ContextPill, {
    type: "missing"
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "center",
      whiteSpace: "nowrap"
    }
  }, renderGrade(assignment)), /*#__PURE__*/React.createElement("td", null, !assignment?.score_statistics ? null : /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 1920 1920",
    xmlns: "http://www.w3.org/2000/svg",
    style: {
      width: "16px",
      height: "16px",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      cursor: "pointer",
      backgroundColor: "#f2f4f4",
      borderRadius: "4px",
      border: "1px solid #e8eaec",
      color: "rgb(99, 109, 117)",
      padding: ".5em"
    },
    onClick: hideDetailCallback
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1709.289 959.673v854.604H341.808v-797.744h113.947v683.797H1595.34V959.673h113.948ZM1840.35 434.57l79.65 81.586-797.63 779.627-364.518-356.54 79.649-81.36 284.868 278.488 717.982-701.801ZM455.789 105v341.956h341.956v113.947H455.789v341.728H341.842V560.903H0V446.956h341.842V105h113.947Zm1082.533 341.876v113.947h-626.71V446.876h626.71Z",
    "fill-rule": "evenodd"
  })), !assignment?.omit_from_final_grade ? null : /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 1920 1920",
    xmlns: "http://www.w3.org/2000/svg",
    style: {
      width: "16px",
      height: "16px",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      cursor: "pointer",
      backgroundColor: "#f2f4f4",
      borderRadius: "4px",
      border: "1px solid #e8eaec",
      color: "rgb(99, 109, 117)",
      padding: ".5em"
    },
    onClick: hideDetailCallback
  }, /*#__PURE__*/React.createElement("path", {
    d: "M960 0c530.193 0 960 429.807 960 960s-429.807 960-960 960S0 1490.193 0 960 429.807 0 960 0Zm0 101.053c-474.384 0-858.947 384.563-858.947 858.947S485.616 1818.947 960 1818.947 1818.947 1434.384 1818.947 960 1434.384 101.053 960 101.053Zm-9.32 1221.49c-80.024 0-145.128 65.105-145.128 145.129 0 80.024 65.104 145.128 145.128 145.128 80.024 0 145.128-65.104 145.128-145.128 0-80.024-65.104-145.128-145.128-145.128Zm192.785-968.859h-385.57l93.901 851.327h197.768l93.901-851.327Z",
    "fill-rule": "evenodd"
  })))), /*#__PURE__*/React.createElement("tr", {
    style: {
      display: detailsHidden || !assignment?.omit_from_final_grade ? "none" : "table-row"
    },
    className: "grade-row-details",
    key: `${assignment.id}-details`
  }, /*#__PURE__*/React.createElement("td", {
    colSpan: "6",
    style: {
      padding: "0.5em 1em"
    }
  }, /*#__PURE__*/React.createElement("strong", null, "This Assignment does not count twoards the final grade."))), /*#__PURE__*/React.createElement("tr", {
    style: {
      display: detailsHidden || !assignment?.score_statistics ? "none" : "table-row"
    },
    className: "grade-row-details",
    key: `${assignment.id}-details`
  }, /*#__PURE__*/React.createElement("td", {
    colSpan: "6",
    style: {
      padding: "0.5em 1em"
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      maxWidth: "90%",
      minWidth: "80%",
      borderCollapse: "collapse"
    }
  }, /*#__PURE__*/React.createElement("thead", {
    style: {
      borderBottom: "1px solid #ccc"
    }
  }, /*#__PURE__*/React.createElement("tr", {
    style: {
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("th", {
    colSpan: "3",
    style: {
      textAlign: "left"
    }
  }, "Score Details"), /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: "right",
      paddingRight: "1em"
    }
  }, /*#__PURE__*/React.createElement("a", {
    onClick: hideDetailCallback,
    className: "assignment-link",
    style: {
      float: "right",
      fontWeight: "normal"
    }
  }, "Close")))), /*#__PURE__*/React.createElement("tbody", null, /*#__PURE__*/React.createElement("tr", {
    className: "grade-row",
    style: {
      fontSize: "14px",
      color: "rgb(39, 53, 64)"
    }
  }, /*#__PURE__*/React.createElement("td", null, "Mean: ", assignment?.score_statistics?.mean || "-", " ", /*#__PURE__*/React.createElement("br", null), " Median: ", assignment?.score_statistics?.median || "-", " "), /*#__PURE__*/React.createElement("td", null, "High: ", assignment?.score_statistics?.max || "-", " ", /*#__PURE__*/React.createElement("br", null), " Upper Quartile: ", assignment?.score_statistics?.median || "-", " "), /*#__PURE__*/React.createElement("td", null, "Low: ", assignment?.score_statistics?.min || "0", " ", /*#__PURE__*/React.createElement("br", null), " Lower Quartile: ", assignment?.score_statistics?.median || "-", " "), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(ScoreDistributionGraph, {
    assignment: assignment
  }))))))));
}
/**
 * Home Page component that displays the home page content. It checks if the courseData is available and renders the appropriate content.
 */
function HomePage() {
  const {
    courseData
  } = useCourseContext();
  if (!courseData) {
    return /*#__PURE__*/React.createElement("div", null, "Loading...");
  }
  if (!courseData.FrontPage) {
    return /*#__PURE__*/React.createElement("div", null, "No course home page available.");
  } else if (courseData.FrontPage) {
    return courseData.FrontPage.body ? /*#__PURE__*/React.createElement("div", {
      className: "page-div"
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        color: "#666666",
        fontSize: 28.8
      }
    }, courseData.manifest.course), /*#__PURE__*/React.createElement("div", {
      id: "home-page-content",
      dangerouslySetInnerHTML: {
        __html: courseData.FrontPage.body
      }
    })) : /*#__PURE__*/React.createElement("div", null, "No content available for the course home page.");
  }
}
function MainContent() {
  const [showCourseList, setShowCourseList] = useState(true);
  const {
    activeKey,
    selectedAssignmentId,
    selectedPageUrl,
    selectedDiscussionId,
    selectedAnnouncementId,
    navigateToSection
  } = useNavigation();
  const {
    courseData
  } = useCourseContext();
  const elements = React.useMemo(() => {
    if (!courseData) return [];
    console.log("Course data:", courseData);
    const list = [];
    if (courseData.FrontPage) {
      list.push({
        key: "frontpage",
        title: "Home"
      });
    }
    if (courseData.Assignments) {
      list.push({
        key: "assignments",
        title: "Assignments"
      });
      list.push({
        key: "grades",
        title: "Grades"
      });
    }
    if (courseData.Modules) {
      list.push({
        key: "modules",
        title: "Modules"
      });
    }
    if (courseData.Discussions && Object.keys(courseData.Discussions || {}).length > 0) {
      list.push({
        key: "discussions",
        title: "Discussions"
      });
    }
    if (courseData.Files && (courseData.Files?.files?.length > 0 || courseData.Files?.folders?.length > 1)) {
      list.push({
        key: "files",
        title: "Files"
      });
    }
    if (courseData.Pages) {
      list.push({
        key: "pages",
        title: "Pages"
      });
    }
    if (courseData.Announcements) {
      list.push({
        key: "announcements",
        title: "Announcements"
      });
    }
    return list;
  }, [courseData]);

  // Set initial active key safely in useEffect when course data loads
  useEffect(() => {
    if (courseData && !activeKey) {
      if (courseData.FrontPage) {
        navigateToSection("frontpage");
      } else if (elements.length > 0) {
        navigateToSection(elements[0].key);
      }
    }
  }, [courseData, elements, activeKey]);

  // Find selected assignment object if viewing one
  const currentAssignment = React.useMemo(() => {
    if (!selectedAssignmentId || !courseData?.Assignments) return null;
    const list = Array.isArray(courseData.Assignments) ? courseData.Assignments : Object.values(courseData.Assignments);
    return list.find(a => String(a.id) === String(selectedAssignmentId));
  }, [selectedAssignmentId, courseData]);

  // Find selected page object if viewing one
  const currentPage = React.useMemo(() => {
    if (!selectedPageUrl || !courseData?.Pages) return null;
    const list = Array.isArray(courseData.Pages) ? courseData.Pages : Object.values(courseData.Pages);
    return list.find(p => String(p.url) === String(selectedPageUrl) || String(p.page_id) === String(selectedPageUrl) || String(p.id) === String(selectedPageUrl));
  }, [selectedPageUrl, courseData]);

  // Dynamic breadcrumbs based on navigation state, never show breadcrumb for frontpage
  const breadcrumbList = React.useMemo(() => {
    const crumbs = [];
    if (activeKey === "assignments") {
      crumbs.push({
        title: "Assignments",
        callback: () => navigateToSection("assignments")
      });
      if (currentAssignment) {
        crumbs.push({
          title: currentAssignment.name
        });
      }
    } else if (activeKey === "pages") {
      crumbs.push({
        title: "Pages",
        callback: () => navigateToSection("pages")
      });
      if (currentPage) {
        crumbs.push({
          title: currentPage.title || "Page Details"
        });
      }
    } else if (activeKey === "frontpage") {
      return crumbs;
    } else {
      crumbs.push({
        title: activeKey.charAt(0).toUpperCase() + activeKey.slice(1)
      });
    }
    return crumbs;
  }, [activeKey, currentAssignment, currentPage]);
  return /*#__PURE__*/React.createElement("main", {
    style: {
      marginLeft: "0px",
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "top-nav"
  }, /*#__PURE__*/React.createElement("button", {
    id: "courseMenuToggle",
    onClick: () => setShowCourseList(!showCourseList)
  }, /*#__PURE__*/React.createElement("svg", {
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "12",
    x2: "21",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "6",
    x2: "21",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "18",
    x2: "21",
    y2: "18"
  }))), /*#__PURE__*/React.createElement(TopBreadcrumbs, {
    list: breadcrumbList
  })), /*#__PURE__*/React.createElement("div", {
    className: "bottom_section",
    style: {
      display: "flex",
      flexDirection: "row",
      alignItems: "flex-start",
      // Prevents full-height stretching so stickiness works
      marginRight: "20px",
      marginLeft: "20px"
    }
  }, showCourseList && /*#__PURE__*/React.createElement(CourseList, {
    elements: elements,
    activeKey: activeKey,
    callback: key => navigateToSection(key)
  }), renderActiveContent(activeKey, currentAssignment, currentPage, selectedDiscussionId, selectedAnnouncementId)));
}
/**
 * Switch statement to render the appropriate content based on the activeKey. It currently handles the "frontPage" case and a default case for other keys.
 */
function renderActiveContent(activeKey, currentAssignment, currentPage, selectedDiscussionId, selectedAnnouncementId) {
  switch (activeKey) {
    case "assignments":
      return currentAssignment ? /*#__PURE__*/React.createElement(AssignmentDetailView, {
        assignment: currentAssignment
      }) : /*#__PURE__*/React.createElement(AssignmentsPage, null);
    case "grades":
      return /*#__PURE__*/React.createElement(GradesPage, null);
    case "modules":
      return /*#__PURE__*/React.createElement(ModulesPage, null);
    case "pages":
      return currentPage ? /*#__PURE__*/React.createElement(PageDetailView, {
        page: currentPage
      }) : /*#__PURE__*/React.createElement(PagesPage, null);
    case "files":
      return /*#__PURE__*/React.createElement(FilesPage, null);
    case "discussions":
      return selectedDiscussionId ? /*#__PURE__*/React.createElement(DiscussionDetailView, {
        discussionId: selectedDiscussionId
      }) : /*#__PURE__*/React.createElement(DiscussionsPage, null);
    case "announcements":
      return selectedAnnouncementId ? /*#__PURE__*/React.createElement(AnnouncementDetailPage, null) : /*#__PURE__*/React.createElement(AnnouncementsPage, null);
    case "frontpage":
      return /*#__PURE__*/React.createElement(HomePage, null);
    default:
      return /*#__PURE__*/React.createElement("div", {
        className: "canvas_content"
      }, "We are sorry, but the section you are trying to visit has either not been implemenented or there is a problem with the course data.", /*#__PURE__*/React.createElement("h1", null, "Active key: ", activeKey));
      break;
  }
}
/**
 * 
 * @returns The main viewer
 */
function ModulesPage() {
  const {
    courseData
  } = useCourseContext();
  const {
    useState,
    useMemo
  } = React;
  if (!courseData) {
    return /*#__PURE__*/React.createElement("div", null, "Loading...");
  }
  if (!courseData.Modules) {
    return /*#__PURE__*/React.createElement("div", null, "No modules available.");
  }
  // Convert dictionary object or array into a flat array of modules
  const moduleList = Array.isArray(courseData.Modules) ? courseData.Modules : Object.values(courseData.Modules);
  const [openStates, setOpenStates] = useState(() => {
    const initial = {};
    moduleList.forEach(m => {
      initial[m.id] = true;
    });
    return initial;
  });
  // Derived state: If AT LEAST ONE module is open, button action is "Collapse All".
  // If ALL modules are collapsed (none are open), button action is "Expand All".
  const isAnyOpen = useMemo(() => {
    return Object.values(openStates).some(isOpen => isOpen === true);
  }, [openStates]);

  // Toggle individual module header click
  const handleToggleModule = id => {
    setOpenStates(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Master button toggle handler
  const handleMasterToggle = () => {
    const nextState = !isAnyOpen; // If any open -> hide all (false); if all closed -> expand all (true)
    const updated = {};
    moduleList.forEach(m => {
      updated[m.id] = nextState;
    });
    setOpenStates(updated);
  };
  const handleItemType = item => {
    if (!item || !item.type) return "assignment"; // Default to assignment if type is missing
    if (item?.quiz_lti && item?.quiz_lti == true) {
      return "quiz";
    }
    return item.type.toLowerCase(); // Return the type in lowercase for consistency
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "page-div",
    style: {
      marginBottom: "4em",
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      color: "#666666",
      fontSize: 28.8
    }
  }, "Modules"), /*#__PURE__*/React.createElement("button", {
    onClick: handleMasterToggle,
    style: {
      backgroundColor: "#f2f4f4",
      border: "1px solid #e8eaec",
      padding: "8px 14px 8px 14px",
      borderRadius: "3px",
      cursor: "pointer",
      fontSize: "16px",
      color: "#273540"
    }
  }, isAnyOpen ? "Collapse All" : "Expand All")), moduleList.map((module, index) => /*#__PURE__*/React.createElement(CollapseTable, {
    title: module.name,
    style: {
      marginBottom: "4em"
    },
    key: module.id,
    isModuleItem: true,
    isOpen: openStates[module.id] ?? true,
    onToggle: () => handleToggleModule(module.id)
  }, module.items.map((item, itemIndex) => /*#__PURE__*/React.createElement(CollapseListItemDetails, {
    key: item.id,
    closed: item?.availability_status?.status || "Unknown" // Uses 'availability_status.status' from Canvas JSON
    ,
    title: item?.title || "No Title" // Uses 'title' from Canvas JSON
    ,
    dueDate: item?.due_at ? fixDateFormat(item?.due_at) : "No Due Date",
    grade: item?.submission?.score || "-",
    maxGrade: item?.points_possible // Uses 'points_possible' from Canvas JSON
    ,
    type: handleItemType(item) // Uses 'type' from Canvas JSON, converted to lowercase
    ,
    assignment: item.type == "Assignment" ? item : undefined,
    pageUrl: item.type == "Page" ? item.page_url || item.url : undefined,
    isModuleItem: true,
    indent: item?.indent ?? 0 // Uses 'indent' from Canvas JSON to determine the indentation level of the module item
  })))));
}
/**
 * Canvas-esque name profile card
 * @param {Object} props
 * @param {string} props.name - The name to display
 * @param {string} props.date - The date to display
 * @param {boolean} props.includeProfileCircle - Whether to include the profile circle
 * @param {boolean} props.includeName - Whether to include the name
 * @param {Object} props.nameStyle - The style to apply to the name (and date)
 * @returns {React.Component} The name profile card
 */
function NameProfileCard({
  name,
  date,
  includeProfileCircle = true,
  includeName = true,
  nameStyle
}) {
  let initials = name.split(" ").map(name => name[0]).join("");
  initials = initials.toUpperCase();
  let dateString = "-";
  if (date) {
    dateString = fixDateFormat(date);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "1em"
    }
  }, includeProfileCircle && /*#__PURE__*/React.createElement("div", {
    style: {
      border: "2px solid rgb(141, 149, 159)",
      color: "rgb(43, 122, 188)",
      fontWeight: "700",
      borderRadius: "50%",
      minHeight: "50px",
      minWidth: "50px",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontSize: "1.25 rem"
    }
  }, initials), includeName && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      ...nameStyle
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: "bold"
    }
  }, name), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "rgb(99, 109, 117)"
    }
  }, dateString)));
}
/**
 * Renders the page selected by the user using _dangerouslySetInnerHTML
 * @param {Object} page - The page object from the course data
 * @returns {React.Component} The page detail view
 */
function PageDetailView({
  page
}) {
  const {
    dirHandle
  } = useCourseContext();
  const [bodyHtml, setBodyHtml] = useState(page?.body || null);
  const [isLoading, setIsLoading] = useState(!page?.body);
  const [error, setError] = useState(null);
  useEffect(() => {
    let isMounted = true;
    async function loadPageBody() {
      if (page?.body) {
        setBodyHtml(page.body);
        setIsLoading(false);
        return;
      }
      if (!dirHandle) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        setError(null);
        let pagesHandle = null;
        try {
          pagesHandle = await dirHandle.getDirectoryHandle("Pages");
        } catch (err) {
          console.warn("Pages directory handle not found:", err);
        }
        if (!pagesHandle) {
          if (isMounted) {
            setError("Pages folder not found locally.");
            setIsLoading(false);
          }
          return;
        }
        const targetUrlRaw = (page.url || page.title || "").toLowerCase().trim();
        const targetUrlSanitized = sanitizeFilename(page.url || page.title || "").toLowerCase().trim();
        let matchedFileHandle = null;
        for await (const entry of pagesHandle.values()) {
          if (entry.kind === "file" && (entry.name.endsWith(".html") || entry.name.endsWith(".htm"))) {
            const nameWithoutExt = entry.name.replace(/\.html?$/i, "").toLowerCase().trim();
            const nameSanitized = sanitizeFilename(nameWithoutExt).toLowerCase().trim();
            if (nameWithoutExt === targetUrlRaw || nameSanitized === targetUrlSanitized || nameWithoutExt.includes(targetUrlSanitized) || targetUrlSanitized.includes(nameSanitized)) {
              matchedFileHandle = entry;
              break;
            }
          }
        }
        if (matchedFileHandle) {
          const file = await matchedFileHandle.getFile();
          const text = await file.text();
          if (isMounted) {
            setBodyHtml(text);
          }
        } else {
          if (isMounted) {
            setError("Page content file not found locally.");
          }
        }
      } catch (err) {
        console.error("Error reading local page file:", err);
        if (isMounted) {
          setError("Failed to load page content.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    loadPageBody();
    return () => {
      isMounted = false;
    };
  }, [page, dirHandle]);
  if (!page) {
    return /*#__PURE__*/React.createElement("h1", null, "No Page Selected");
  }
  function customDateFormat(dateStr) {
    if (!dateStr) return null;
    const dateObj = new Date(dateStr);
    return dateObj.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric"
    });
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      marginBottom: "8em"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "assignment-student-header",
    style: {
      borderBottom: "2px solid #39454e",
      paddingBottom: "0.75em"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "assignment-student-header-title"
  }, page.title), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "14px",
      color: "#555",
      marginTop: "4px"
    }
  }, page.updated_at ? `Last updated: ${customDateFormat(page.updated_at)}` : page.created_at ? `Created: ${customDateFormat(page.created_at)}` : "")), page.front_page && /*#__PURE__*/React.createElement("span", {
    style: {
      backgroundColor: "#00842c",
      color: "#fff",
      padding: "4px 10px",
      borderRadius: "12px",
      fontSize: "12px",
      fontWeight: "bold",
      alignSelf: "center"
    }
  }, "Front Page")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "1.5em"
    }
  }, isLoading && /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#666",
      padding: "1em"
    }
  }, "Loading page content..."), error && /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#c00",
      padding: "1em",
      backgroundColor: "#fee",
      borderRadius: "4px"
    }
  }, error), !isLoading && !error && bodyHtml && /*#__PURE__*/React.createElement("div", {
    className: "assignment-details",
    dangerouslySetInnerHTML: {
      __html: bodyHtml
    }
  }), !isLoading && !error && !bodyHtml && /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#666",
      padding: "1em"
    }
  }, "No content available for this page.")));
}
/**
 * Creates the list of pages for the course.
 * @returns {JSX.Element} list of pages for the entire course
 */
function PagesPage() {
  const {
    courseData
  } = useCourseContext();
  const {
    navigateToPage
  } = useNavigation();
  if (!courseData) {
    return /*#__PURE__*/React.createElement("div", null, "Loading...");
  }
  if (!courseData.Pages || courseData.Pages.length === 0) {
    return /*#__PURE__*/React.createElement("div", null, "No pages available.");
  }
  const pagesList = Array.isArray(courseData.Pages) ? courseData.Pages : Object.values(courseData.Pages);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      marginBottom: "8em"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      color: "#666666",
      fontSize: 28.8
    }
  }, "Pages"), /*#__PURE__*/React.createElement("div", {
    className: "pages-container",
    style: {
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "pages-table",
    style: {
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      borderBottom: "2px solid rgb(39, 53, 64)"
    }
  }, /*#__PURE__*/React.createElement("th", {
    style: {
      minWidth: "fit-content",
      whiteSpace: "nowrap"
    }
  }, "Title"), /*#__PURE__*/React.createElement("th", {
    style: {
      minWidth: "fit-content",
      whiteSpace: "nowrap"
    }
  }, "Creation Date"), /*#__PURE__*/React.createElement("th", {
    style: {
      minWidth: "fit-content",
      whiteSpace: "nowrap"
    }
  }, "Updated at"))), /*#__PURE__*/React.createElement("tbody", null, pagesList.map((page, index) => /*#__PURE__*/React.createElement("tr", {
    key: page.page_id || page.url || page.id || index,
    style: {
      backgroundColor: index % 2 === 0 ? "#f2f4f4" : "white"
    }
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("a", {
    className: "assignment-link",
    onClick: e => {
      e.preventDefault();
      navigateToPage(page.url || page.page_id || page.id);
    }
  }, page.title), page.front_page && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "8px",
      fontSize: "11px",
      backgroundColor: "#00842c",
      color: "#fff",
      padding: "2px 6px",
      borderRadius: "10px",
      fontWeight: "bold"
    }
  }, "Front Page")), /*#__PURE__*/React.createElement("td", {
    style: {
      minWidth: "fit-content",
      whiteSpace: "nowrap"
    }
  }, page.created_at ? new Date(page.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }) : "-"), /*#__PURE__*/React.createElement("td", {
    style: {
      minWidth: "fit-content",
      whiteSpace: "nowrap"
    }
  }, page.updated_at ? new Date(page.updated_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }) : "-")))))));
}
/**
 * Reformats Canvas date strings to a more readable format
 * @param {string} dateString - The date string to reformat
 * @returns {string} The reformatted date string
 */
function fixDateFormat(dateString) {
  //Reformats Canvas date strings to a more readable format
  // Example input: 2022-08-29T22:30:00Z
  // Example output: Jun 7 at 11:59pm
  if (!dateString) return "";
  const date = new Date(dateString);
  const datePart = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).toLowerCase().replace(/\s+/g, ""); // Converts "10:30 PM" -> "10:30pm"

  return `${datePart} at ${timePart}`;
}

/**
 * Detects the current execution environment of the application.
 * @returns {string} The current execution environment.
 */
function getAppContext() {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;

  // 1. Local HTML file opened directly from the hard drive
  if (protocol === "file:") {
    return "local_file";
  }

  // 2. Running inside a browser extension (Chrome, Edge, Brave, Opera, Firefox)
  if (protocol === "chrome-extension:" || protocol === "moz-extension:") {
    return "extension";
  }

  // 3. Hosted on a web server
  if (protocol === "http:" || protocol === "https:") {
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "localhost";
    }
    return "website";
  }
  return "unknown";
}

/** Replaces characters that are invalid or problematic in file paths.
 * Taken from the helpers.js file.
 * @param {string} name The name of the file to sanitize
 * @returns {string} The sanitized filename
 */
function sanitizeFilename(name) {
  if (!name) return "untitled";
  const cleaned = name.replace(/[\u0000-\u001F\u007F]/g, "") // control chars
  .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width chars
  .replace(/\u00A0/g, " ") // non-breaking space
  .replace(/[/\\?%*:|"<>]/g, "-") // OS-reserved chars
  .replace(/^\.+/, "") // leading dots
  .replace(/[. ]+$/, "") // trailing dots/spaces
  .replace(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i, "_$1$2") // Windows reserved names
  .trim();
  return cleaned || "untitled";
}

/**
 * Detects the mime class of a file object.
 * @param {*} fileObj - The file object to detect the mime class of.
 * @returns {string} The mime class of the file object.
 */
function getMimeClass(fileObj) {
  if (!fileObj) return "unknown";
  if (fileObj.mime_class) return fileObj.mime_class;
  const contentType = (fileObj["content-type"] || fileObj.contentType || "").toLowerCase();
  const filename = (fileObj.display_name || fileObj.filename || "").toLowerCase();
  if (contentType.startsWith("image/") || /\.(jpg|jpeg|png|gif|svg|webp|bmp|ico)$/.test(filename)) return "image";
  if (contentType.startsWith("video/") || /\.(mp4|webm|ogg|mov|avi|mkv)$/.test(filename)) return "video";
  if (contentType === "application/pdf" || filename.endsWith(".pdf")) return "pdf";
  if (contentType.startsWith("text/") || /\.(txt|md|csv|json|js|py|c|cpp|css|xml)$/.test(filename)) return "text";
  if (contentType.includes("html") || /\.(html|htm)$/.test(filename)) return "html";
  if (contentType.includes("word") || contentType.includes("officedocument.wordprocessingml") || /\.(doc|docx)$/.test(filename)) return "doc";
  if (contentType.includes("powerpoint") || contentType.includes("officedocument.presentationml") || /\.(ppt|pptx)$/.test(filename)) return "ppt";
  if (contentType.includes("excel") || contentType.includes("officedocument.spreadsheetml") || /\.(xls|xlsx)$/.test(filename)) return "xls";
  return "unknown";
}

/**
 * Calculates the grade for a specific assignment group.
 * @param {*} group - The assignment group to calculate the grade for.
 * @param {*} assignments - The list of assignments.
 * @returns {Object} An object containing the total points possible, total points earned, and the percentage for the assignment group.
 */
function calculateGradeForGroup(group, assignments) {
  const groupAssignments = assignments.filter(assignment => assignment.assignment_group_id === group.id && assignment.submission?.grade != null && !assignment.omit_from_final_grade);
  const totalPointsPossible = groupAssignments.reduce((sum, assignment) => sum + (assignment.points_possible || 0), 0);
  const totalPointsEarned = groupAssignments.reduce((sum, assignment) => sum + (assignment.submission?.score || 0), 0);
  return {
    totalPointsPossible,
    totalPointsEarned,
    percentage: totalPointsPossible > 0 ? totalPointsEarned / totalPointsPossible * 100 : null
  };
}
/**
 * Calculates the total weighted grade for all assignments in a course.
 * @param {*} assignments - The list of assignments.
 * @param {*} assignmentGroups - The list of assignment groups.
 * @returns {Object} An object containing the total weighted grade for the course.
 */
function calculateTotalWeightedGrade(assignments, assignmentGroups) {
  if (!assignmentGroups || assignmentGroups.length === 0) {
    // calculate the total grade without weighting if no assignment groups are provided
    const gradedAssignments = assignments.filter(assignment => assignment.submission?.grade != null && !assignment.omit_from_final_grade);
    const totalPointsPossible = gradedAssignments.reduce((sum, assignment) => sum + (assignment.points_possible || 0), 0);
    const totalPointsEarned = gradedAssignments.reduce((sum, assignment) => sum + (assignment.submission?.score || 0), 0);
    return totalPointsPossible > 0 ? totalPointsEarned / totalPointsPossible * 100 : null;
  }
  let totalWeightedScore = 0;
  let totalWeight = 0;
  assignmentGroups.forEach(group => {
    const groupGrade = calculateGradeForGroup(group, assignments);
    if (groupGrade.percentage !== null) {
      totalWeightedScore += groupGrade.percentage * (group.group_weight / 100);
      totalWeight += group.group_weight;
    }
  });
  return totalWeight > 0 ? totalWeightedScore / totalWeight * 100 : null;
}
/**
 * Calculates the total points earned and possible across all assignments regardless of weighting.
 * @param {Array} assignments - The list of assignments.
 * @returns {Object} An object containing totalPointsEarned and totalPointsPossible.
 */
function calculateTotalPoints(assignments) {
  const gradedAssignments = assignments.filter(assignment => assignment.submission?.grade != null && !assignment.omit_from_final_grade);
  const totalPointsPossible = gradedAssignments.reduce((sum, assignment) => sum + (assignment.points_possible || 0), 0);
  const totalPointsEarned = gradedAssignments.reduce((sum, assignment) => sum + (assignment.submission?.score || 0), 0);
  return {
    totalPointsPossible,
    totalPointsEarned
  };
}

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbImNvbnRleHRzL0NvdXJzZUNvbnRleHQuanN4IiwiY29udGV4dHMvTmF2aWdhdGlvbkNvbnRleHQuanN4IiwiY29tcG9uZW50cy9Bc3NpZ25tZW50UnVicmljLmpzeCIsImNvbXBvbmVudHMvQ2FudmFzSXRlbUljb24uanN4IiwiY29tcG9uZW50cy9DYW52YXNTdWJtaXNzaW9uLmpzeCIsImNvbXBvbmVudHMvQ29sbGFwc2VUYWJsZS5qc3giLCJjb21wb25lbnRzL0NvbnRleHRQaWxsLmpzeCIsImNvbXBvbmVudHMvQ291cnNlTGlzdC5qc3giLCJjb21wb25lbnRzL0NvdXJzZVBpY2tlci5qc3giLCJjb21wb25lbnRzL0RvY3hNZW1vcnlWaWV3ZXIuanN4IiwiY29tcG9uZW50cy9Mb2NhbEF0YXRjaG1lbnRWaWV3ZXIuanN4IiwiY29tcG9uZW50cy9QcHR4TWVtb3J5Vmlld2VyLmpzeCIsImNvbXBvbmVudHMvU2NvcmVEaXN0cmlidXRpb25HcmFwaC5qc3giLCJjb21wb25lbnRzL1RvcEJyZWFkY3J1bWJzLmpzeCIsInBhZ2VzL0Fubm91bmNlbWVudERldGFpbFBhZ2UuanN4IiwicGFnZXMvQW5ub3VuY2VtZW50c1BhZ2UuanN4IiwicGFnZXMvQXBwLmpzeCIsInBhZ2VzL0Fzc2lnbm1lbnREZXRhaWxWaWV3LmpzeCIsInBhZ2VzL0Fzc2lnbm1lbnRzUGFnZS5qc3giLCJwYWdlcy9EaXNjdXNzaW9uRGV0YWlsVmlldy5qc3giLCJwYWdlcy9EaXNjdXNzaW9uc1BhZ2UuanN4IiwicGFnZXMvRmlsZXNQYWdlLmpzeCIsInBhZ2VzL0ZpbGVzUGFnZURldGFpbFZpZXcuanN4IiwicGFnZXMvR3JhZGVzUGFnZS5qc3giLCJwYWdlcy9Ib21lUGFnZS5qc3giLCJwYWdlcy9NYWluQ29udGVudC5qc3giLCJwYWdlcy9Nb2R1bGVzUGFnZS5qc3giLCJwYWdlcy9OYW1lUHJvZmlsZUNhcmQuanN4IiwicGFnZXMvUGFnZURldGFpbFZpZXcuanN4IiwicGFnZXMvUGFnZXNQYWdlLmpzeCIsImhlbHBlcnMvSGVscGVycy5qc3giXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDb3Vyc2VDb250ZXh0IGNyZWF0ZXMgYW5kIHN0b3JlcyB0aGUgQ291cnNlIGRhdGEgZm9yIGxvYWRpbmcgYW5kIGRpc3BsYXlpbmcuIE9uY2UgdGhlIGRhdGEgaXMgcmV0cmlldmVkIHVzaW5nXG4gKiB0aGUgRmlsZSBTeXN0ZW0gQVBJLCB0aGUgZm9sZGVyIHJlZmVyZXJlciBpcyBzYXZlZCB0byBpbmRleGVkZGIgc28gaXQgY2FuIGJlIGFjY2Vzc2VkIGxhdGVyLlxuICovXG5cbmNvbnN0IHsgY3JlYXRlQ29udGV4dCwgdXNlQ29udGV4dCwgdXNlU3RhdGUsIHVzZUVmZmVjdCB9ID0gUmVhY3Q7XG5cbmNvbnN0IENvdXJzZUNvbnRleHQgPSBjcmVhdGVDb250ZXh0KCk7IC8vIENyZWF0ZSBhIGNvbnRleHQgZm9yIGNvdXJzZSBkYXRhXG5cbi8vIEdldCB0aGUgSW5kZXhkREIgdG9vbHNcbmNvbnN0IHsgZ2V0LCBzZXQsIGRlbCB9ID0gaWRiS2V5dmFsO1xuXG4vKipcbiAqIENyZWF0aW5nIGEgY29udGV4dCBmb3IgY291cnNlIGRhdGEgc28gaXQgY2FuIGJlIGFjY2Vzc2VkIGJ5IGFsbCBjb21wb25lbnRzLlxuICovXG5cbi8vIEhlbHBlciBmdW5jdGlvbiB0byBjaGVjayBhbmQgcmVxdWVzdCBwZXJtaXNzaW9ucyBmb3IgYSBoYW5kbGVcbmFzeW5jIGZ1bmN0aW9uIHZlcmlmeVBlcm1pc3Npb24oZGlyZWN0b3J5SGFuZGxlLCBtb2RlID0gXCJyZWFkXCIpIHtcbiAgY29uc3Qgb3B0aW9ucyA9IHsgbW9kZSB9O1xuXG4gIC8vIENoZWNrIGlmIHdlIGFscmVhZHkgaGF2ZSBwZXJtaXNzaW9uXG4gIGlmICgoYXdhaXQgZGlyZWN0b3J5SGFuZGxlLnF1ZXJ5UGVybWlzc2lvbihvcHRpb25zKSkgPT09IFwiZ3JhbnRlZFwiKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyBJZiBub3QsIHJlcXVlc3QgcGVybWlzc2lvbiAodGhpcyBtdXN0IGJlIHRyaWdnZXJlZCBieSBhIHVzZXIgZ2VzdHVyZSwgbGlrZSBhIGJ1dHRvbiBjbGljaylcbiAgaWYgKChhd2FpdCBkaXJlY3RvcnlIYW5kbGUucmVxdWVzdFBlcm1pc3Npb24ob3B0aW9ucykpID09PSBcImdyYW50ZWRcIikge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBDb3Vyc2VDb250ZXh0UHJvdmlkZXIoeyBjaGlsZHJlbiB9KSB7XG4gIGNvbnN0IFtjb3Vyc2VEYXRhLCBzZXRDb3Vyc2VEYXRhXSA9IHVzZVN0YXRlKG51bGwpO1xuICBjb25zdCBbZGlySGFuZGxlLCBzZXREaXJIYW5kbGVdID0gdXNlU3RhdGUobnVsbCk7XG4gIGNvbnN0IFtpc1Byb2Nlc3NpbmcsIHNldElzUHJvY2Vzc2luZ10gPSB1c2VTdGF0ZSh0cnVlKTsgLy8gU3RhcnQgbG9hZGluZyBzYXZlZCBkYXRhXG5cbiAgLy8gT24gbW91bnQsIGxvYWQgcHJldmlvdXNseSBzYXZlZCBKU09OIGRhdGEgYW5kIHRoZSBkaXJlY3RvcnkgaGFuZGxlIGZyb20gSW5kZXhlZERCXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgYXN5bmMgZnVuY3Rpb24gbG9hZENhY2hlZERhdGEoKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBbY2FjaGVkRGF0YSwgY2FjaGVkSGFuZGxlXSA9IGF3YWl0IFByb21pc2UuYWxsKFtnZXQoXCJjYWNoZWRDb3Vyc2VEYXRhXCIpLCBnZXQoXCJjb3Vyc2VEaXJlY3RvcnlIYW5kbGVcIildKTtcblxuICAgICAgICBpZiAoY2FjaGVkRGF0YSkgc2V0Q291cnNlRGF0YShjYWNoZWREYXRhKTtcbiAgICAgICAgaWYgKGNhY2hlZEhhbmRsZSkgc2V0RGlySGFuZGxlKGNhY2hlZEhhbmRsZSk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiRmV0Y2hlZCBDb3Vyc2UgRGF0YSFcIilcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiRmFpbGVkIHRvIGxvYWQgY2FjaGVkIGRhdGEgZnJvbSBzdG9yYWdlOlwiLCBlcnIpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgc2V0SXNQcm9jZXNzaW5nKGZhbHNlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsb2FkQ2FjaGVkRGF0YSgpO1xuICB9LCBbXSk7XG5cbiAgLy8gSW5pdGlhbCBmb2xkZXIgc2VsZWN0aW9uIChVc2VyIHBpY2tzIHRoZSBmb2xkZXIpXG4gIGNvbnN0IGhhbmRsZUZvbGRlclNlbGVjdCA9IGFzeW5jICgpID0+IHtcbiAgICBzZXRJc1Byb2Nlc3NpbmcodHJ1ZSk7XG4gICAgdHJ5IHtcbiAgICAgIC8vIFByb21wdCB1c2VyIGZvciBmb2xkZXIgYWNjZXNzICh1c2luZyBGaWxlIFN5c3RlbSBBY2Nlc3MgQVBJKVxuICAgICAgY29uc3QgaGFuZGxlID0gYXdhaXQgd2luZG93LnNob3dEaXJlY3RvcnlQaWNrZXIoKTtcbiAgICAgIGxldCBqc29uRmlsZXNPYmplY3QgPSBhd2FpdCBzY3JhcGVKc29uRmlsZXMoaGFuZGxlKTtcblxuICAgICAgaWYgKGpzb25GaWxlc09iamVjdD8ubWFuaWZlc3Q/Lm1hbmlmZXN0VmVyc2lvbiA+PSAyKSB7XG4gICAgICAgIC8vIFNhdmUgdG8gUmVhY3QgU3RhdGVcbiAgICAgICAgc2V0Q291cnNlRGF0YShqc29uRmlsZXNPYmplY3QpO1xuICAgICAgICBzZXREaXJIYW5kbGUoaGFuZGxlKTtcblxuICAgICAgICAvLyBTYXZlIHRvIEluZGV4ZWREQlxuICAgICAgICBhd2FpdCBzZXQoXCJjYWNoZWRDb3Vyc2VEYXRhXCIsIGpzb25GaWxlc09iamVjdCk7XG4gICAgICAgIGF3YWl0IHNldChcImNvdXJzZURpcmVjdG9yeUhhbmRsZVwiLCBoYW5kbGUpOyAvLyA8LS0gU2F2aW5nIHRoZSBoYW5kbGVcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFsZXJ0KFwiSW52YWxpZCBtYW5pZmVzdCB2ZXJzaW9uLiBQbGVhc2Ugc2VsZWN0IGEgdmFsaWQgY291cnNlIGZvbGRlci5cIik7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFwiQWNjZXNzIGRlbmllZCBvciBlcnJvciBkaWdlc3RpbmcgZm9sZGVyXCIsIGVycik7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNldElzUHJvY2Vzc2luZyhmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIC8vIFJlLWF1dGhlbnRpY2F0ZSBhbiBleGlzdGluZyBoYW5kbGUgKFVzZXIgZ3JhbnRzIHBlcm1pc3Npb24gdG8gcHJldmlvdXNseSBzYXZlZCBmb2xkZXIpXG4gIGNvbnN0IHJlY29ubmVjdEZvbGRlciA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAoIWRpckhhbmRsZSkgcmV0dXJuO1xuXG4gICAgc2V0SXNQcm9jZXNzaW5nKHRydWUpO1xuICAgIHRyeSB7XG4gICAgICAvLyBUaGlzIHdpbGwgcHJvbXB0IHRoZSBicm93c2VyIHBlcm1pc3Npb24gZGlhbG9nIGlmIG5lZWRlZFxuICAgICAgY29uc3QgaGFzUGVybWlzc2lvbiA9IGF3YWl0IHZlcmlmeVBlcm1pc3Npb24oZGlySGFuZGxlLCBcInJlYWRcIik7XG5cbiAgICAgIGlmIChoYXNQZXJtaXNzaW9uKSB7XG4gICAgICAgIC8vIFlvdSBub3cgaGF2ZSBhY3RpdmUgYWNjZXNzIHRvIHRoZSBmb2xkZXIgYWdhaW4hXG4gICAgICAgIC8vIE9wdGlvbmFsOiBSZS1zY3JhcGUgdGhlIGZvbGRlciBoZXJlIHRvIGdldCBmcmVzaCBkYXRhIGluc3RlYWQgb2YgdXNpbmcgY2FjaGVcbiAgICAgICAgLy8gbGV0IGZyZXNoRGF0YSA9IGF3YWl0IHNjcmFwZUpzb25GaWxlcyhkaXJIYW5kbGUpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIlBlcm1pc3Npb24gZ3JhbnRlZCEgRGlyZWN0b3J5IGhhbmRsZSBpcyBhY3RpdmUuXCIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWxlcnQoXCJQZXJtaXNzaW9uIHRvIGFjY2VzcyB0aGUgZm9sZGVyIHdhcyBkZW5pZWQuXCIpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIHJlY29ubmVjdGluZyB0byBmb2xkZXI6XCIsIGVycik7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNldElzUHJvY2Vzc2luZyhmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIC8vIENsZWFyIHN0b3JlZCBkYXRhXG4gIGNvbnN0IGNsZWFyQ291cnNlRGF0YSA9IGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBQcm9taXNlLmFsbChbZGVsKFwiY2FjaGVkQ291cnNlRGF0YVwiKSwgZGVsKFwiY291cnNlRGlyZWN0b3J5SGFuZGxlXCIpXSk7XG4gICAgc2V0Q291cnNlRGF0YShudWxsKTtcbiAgICBzZXREaXJIYW5kbGUobnVsbCk7XG4gIH07XG5cbiAgcmV0dXJuIChcbiAgICA8Q291cnNlQ29udGV4dC5Qcm92aWRlclxuICAgICAgdmFsdWU9e3tcbiAgICAgICAgY291cnNlRGF0YSxcbiAgICAgICAgZGlySGFuZGxlLFxuICAgICAgICBpc1Byb2Nlc3NpbmcsXG4gICAgICAgIGhhbmRsZUZvbGRlclNlbGVjdCxcbiAgICAgICAgcmVjb25uZWN0Rm9sZGVyLCAvLyBFeHBvcnQgdGhlIG5ldyBmdW5jdGlvblxuICAgICAgICBjbGVhckNvdXJzZURhdGEsXG4gICAgICB9fVxuICAgID5cbiAgICAgIHtjaGlsZHJlbn1cbiAgICA8L0NvdXJzZUNvbnRleHQuUHJvdmlkZXI+XG4gICk7XG59XG5cbmZ1bmN0aW9uIHVzZUNvdXJzZUNvbnRleHQoKSB7XG4gIHJldHVybiB1c2VDb250ZXh0KENvdXJzZUNvbnRleHQpO1xufVxuLy8gRnVuY3Rpb24gdG8gdGFrZSBkaWdlc3QgdGhlIGZvbGRlciBkYXRhIGludG8gZXZlcnkgYXZhaWxhYmxlIEpTT04gZmlsZVxuYXN5bmMgZnVuY3Rpb24gc2NyYXBlSnNvbkZpbGVzKGRpckhhbmRsZSkge1xuICBjb25zdCBqc29uRmlsZXNPYmplY3QgPSB7fTtcblxuICBhc3luYyBmdW5jdGlvbiB3YWxrRGlyZWN0b3J5KGhhbmRsZSkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgZW50cnkgb2YgaGFuZGxlLnZhbHVlcygpKSB7XG4gICAgICBpZiAoZW50cnkua2luZCA9PT0gXCJmaWxlXCIgJiYgZW50cnkubmFtZS5lbmRzV2l0aChcIi5qc29uXCIpKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gR2V0IHRoZSBzdGFuZGFyZCBGaWxlIG9iamVjdFxuICAgICAgICAgIGNvbnN0IGZpbGUgPSBhd2FpdCBlbnRyeS5nZXRGaWxlKCk7XG5cbiAgICAgICAgICAvLyBSZWFkIGFuZCBwYXJzZSB0aGUgSlNPTiBzdHJpbmdcbiAgICAgICAgICBjb25zdCB0ZXh0ID0gYXdhaXQgZmlsZS50ZXh0KCk7XG4gICAgICAgICAgY29uc3QgcGFyc2VkRGF0YSA9IEpTT04ucGFyc2UodGV4dCk7XG4gICAgICAgICAgY29uc29sZS5sb2coYFBhcnNlZCBKU09OIGZvciBmaWxlOiAke2VudHJ5Lm5hbWV9YCwgcGFyc2VkRGF0YSk7XG5cbiAgICAgICAgICAvLyBVc2UgdGhlIGZpbGUgbmFtZSBhcyB0aGUga2V5LCBzdHJpcHBpbmcgdGhlIC5qc29uIGV4dGVuc2lvblxuICAgICAgICAgIGpzb25GaWxlc09iamVjdFtlbnRyeS5uYW1lLnNsaWNlKDAsIC01KV0gPSBwYXJzZWREYXRhO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYEZhaWxlZCB0byBwYXJzZSBKU09OIGZvciBmaWxlOiAke2VudHJ5Lm5hbWV9YCwgZXJyKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChlbnRyeS5raW5kID09PSBcImRpcmVjdG9yeVwiKSB7XG4gICAgICAgIC8vIFJlY3Vyc2UgaW50byBuZXN0ZWQgc3ViZm9sZGVyc1xuICAgICAgICBhd2FpdCB3YWxrRGlyZWN0b3J5KGVudHJ5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBhd2FpdCB3YWxrRGlyZWN0b3J5KGRpckhhbmRsZSk7XG4gIHJldHVybiBqc29uRmlsZXNPYmplY3Q7XG59XG4iLCIvKipcbiAqIENyZWF0aW5nIGEgY29udGV4dCBzbyB0aGF0IHdlIGNhbiBlbmFibGUgbmF2aWdhdGlvbiB0aHJvdWdob3V0IHRoZSBhcHBcbiAqL1xuY29uc3QgTmF2aWdhdGlvbkNvbnRleHQgPSBSZWFjdC5jcmVhdGVDb250ZXh0KCk7XG5mdW5jdGlvbiBOYXZpZ2F0aW9uUHJvdmlkZXIoeyBjaGlsZHJlbiB9KSB7XG4gIGNvbnN0IFthY3RpdmVLZXksIHNldEFjdGl2ZUtleV0gPSB1c2VTdGF0ZShcImZyb250cGFnZVwiKTtcbiAgY29uc3QgW3NlbGVjdGVkQXNzaWdubWVudElkLCBzZXRTZWxlY3RlZEFzc2lnbm1lbnRJZF0gPSB1c2VTdGF0ZShudWxsKTtcbiAgY29uc3QgW3NlbGVjdGVkUGFnZVVybCwgc2V0U2VsZWN0ZWRQYWdlVXJsXSA9IHVzZVN0YXRlKG51bGwpO1xuICBjb25zdCBbc2VsZWN0ZWREaXNjdXNzaW9uSWQsIHNldFNlbGVjdGVkRGlzY3Vzc2lvbklkXSA9IHVzZVN0YXRlKG51bGwpO1xuICBjb25zdCBbc2VsZWN0ZWRBbm5vdW5jZW1lbnRJZCwgc2V0U2VsZWN0ZWRBbm5vdW5jZW1lbnRJZF0gPSB1c2VTdGF0ZSgpO1xuXG4gIC8vIE5hdmlnYXRlIHRvIGEgbWFpbiBzZWN0aW9uIChyZXNldHMgc3ViLXZpZXcgZGV0YWlsKVxuICBjb25zdCBuYXZpZ2F0ZVRvU2VjdGlvbiA9IChrZXkpID0+IHtcbiAgICBzZXRBY3RpdmVLZXkoa2V5KTtcbiAgICBzZXRTZWxlY3RlZEFzc2lnbm1lbnRJZChudWxsKTtcbiAgICBzZXRTZWxlY3RlZFBhZ2VVcmwobnVsbCk7XG4gICAgc2V0U2VsZWN0ZWREaXNjdXNzaW9uSWQobnVsbCk7XG4gIH07XG4gIC8vIE5hdmlnYXRlIGRpcmVjdGx5IHRvIGEgc3BlY2lmaWMgYXNzaWdubWVudCBkZXRhaWwgdmlld1xuICBjb25zdCBuYXZpZ2F0ZVRvQXNzaWdubWVudCA9IChhc3NpZ25tZW50SWQpID0+IHtcbiAgICBzZXRBY3RpdmVLZXkoXCJhc3NpZ25tZW50c1wiKTsgLy8gS2VlcHMgXCJBc3NpZ25tZW50c1wiIGFjdGl2ZSBvbiB0aGUgbGVmdCBzaWRlYmFyIVxuICAgIHNldFNlbGVjdGVkQXNzaWdubWVudElkKGFzc2lnbm1lbnRJZCk7XG4gICAgc2V0U2VsZWN0ZWRQYWdlVXJsKG51bGwpO1xuICB9O1xuICAvLyBOYXZpZ2F0ZSBkaXJlY3RseSB0byBhIHNwZWNpZmljIHBhZ2UgZGV0YWlsIHZpZXdcbiAgY29uc3QgbmF2aWdhdGVUb1BhZ2UgPSAocGFnZVVybCkgPT4ge1xuICAgIHNldEFjdGl2ZUtleShcInBhZ2VzXCIpOyAvLyBLZWVwcyBcIlBhZ2VzXCIgYWN0aXZlIG9uIHRoZSBsZWZ0IHNpZGViYXIhXG4gICAgc2V0U2VsZWN0ZWRQYWdlVXJsKHBhZ2VVcmwpO1xuICAgIHNldFNlbGVjdGVkQXNzaWdubWVudElkKG51bGwpO1xuICB9O1xuICBjb25zdCBuYXZpZ2F0ZVRvRGlzY3Vzc2lvbiA9IChkaXNjdXNzaW9uSWQpID0+IHtcbiAgICBzZXRBY3RpdmVLZXkoXCJkaXNjdXNzaW9uc1wiKTsgLy8gS2VlcHMgXCJQYWdlc1wiIGFjdGl2ZSBvbiB0aGUgbGVmdCBzaWRlYmFyIVxuICAgIHNldFNlbGVjdGVkRGlzY3Vzc2lvbklkKGRpc2N1c3Npb25JZCk7XG4gICAgc2V0U2VsZWN0ZWRBc3NpZ25tZW50SWQobnVsbCk7XG4gIH07XG4gIGNvbnN0IG5hdmlnYXRlVG9Bbm5vdW5jZW1lbnQgPSAoYW5ub3VuY2VtZW50SWQpID0+IHtcbiAgICBzZXRBY3RpdmVLZXkoXCJhbm5vdW5jZW1lbnRzXCIpOyAvLyBLZWVwcyBcIlBhZ2VzXCIgYWN0aXZlIG9uIHRoZSBsZWZ0IHNpZGViYXIhXG4gICAgc2V0U2VsZWN0ZWRBbm5vdW5jZW1lbnRJZChhbm5vdW5jZW1lbnRJZCk7XG4gICAgc2V0U2VsZWN0ZWRBc3NpZ25tZW50SWQobnVsbCk7XG4gIH07XG4gIHJldHVybiAoXG4gICAgPE5hdmlnYXRpb25Db250ZXh0LlByb3ZpZGVyXG4gICAgICB2YWx1ZT17e1xuICAgICAgICBhY3RpdmVLZXksXG4gICAgICAgIHNlbGVjdGVkQXNzaWdubWVudElkLFxuICAgICAgICBzZWxlY3RlZFBhZ2VVcmwsXG4gICAgICAgIHNlbGVjdGVkRGlzY3Vzc2lvbklkLFxuICAgICAgICBzZWxlY3RlZEFubm91bmNlbWVudElkLFxuICAgICAgICBuYXZpZ2F0ZVRvU2VjdGlvbixcbiAgICAgICAgbmF2aWdhdGVUb0Fzc2lnbm1lbnQsXG4gICAgICAgIG5hdmlnYXRlVG9QYWdlLFxuICAgICAgICBuYXZpZ2F0ZVRvRGlzY3Vzc2lvbixcbiAgICAgICAgbmF2aWdhdGVUb0Fubm91bmNlbWVudCxcbiAgICAgIH19XG4gICAgPlxuICAgICAge2NoaWxkcmVufVxuICAgIDwvTmF2aWdhdGlvbkNvbnRleHQuUHJvdmlkZXI+XG4gICk7XG59XG5jb25zdCB1c2VOYXZpZ2F0aW9uID0gKCkgPT4gUmVhY3QudXNlQ29udGV4dChOYXZpZ2F0aW9uQ29udGV4dCk7XG4iLCIvKipcbiAqIFRoaXMgZnVuY3Rpb24gcmVuZGVycyB0aGUgcnVicmljIGZvciBhbiBhc3NpZ25tZW50J3MgZGV0YWlsZWQgdmlldy5cbiAqIEBwYXJhbSB7Kn0gcnVicmljIC0gVGhlIHJ1YnJpYyBmb3IgdGhlIGFzc2lnbm1lbnQuXG4gKiBAcmV0dXJucyBUaGUgcnVicmljIGNvbXBvbmVudCBmb3IgdGhlIGFzc2lnbm1lbnQuXG4gKi9cbmZ1bmN0aW9uIEFzc2lnbm1lbnRSdWJyaWMoeyBydWJyaWMgfSkge1xuICBpZiAoIUFycmF5LmlzQXJyYXkocnVicmljKSB8fCBydWJyaWMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPSdhc3NpZ25tZW50LXJ1YnJpYy1jb250YWluZXInIHN0eWxlPXt7IG1hcmdpblRvcDogXCIxZW1cIiB9fT5cbiAgICAgIDxoM1xuICAgICAgICBzdHlsZT17e1xuICAgICAgICAgIGZvbnRTaXplOiBcIjEuMWVtXCIsXG4gICAgICAgICAgbWFyZ2luQm90dG9tOiBcIjAuNWVtXCIsXG4gICAgICAgICAgY29sb3I6IFwiIzI3MzU0MFwiLFxuICAgICAgICB9fVxuICAgICAgPlxuICAgICAgICBSdWJyaWNcbiAgICAgIDwvaDM+XG4gICAgICA8dGFibGVcbiAgICAgICAgY2xhc3NOYW1lPSdydWJyaWMtdGFibGUnXG4gICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgd2lkdGg6IFwiMTAwJVwiLFxuICAgICAgICAgIGJvcmRlckNvbGxhcHNlOiBcImNvbGxhcHNlXCIsXG4gICAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCAjZThlYWVjXCIsXG4gICAgICAgICAgZm9udFNpemU6IFwiMTRweFwiLFxuICAgICAgICB9fVxuICAgICAgPlxuICAgICAgICA8dGhlYWQ+XG4gICAgICAgICAgPHRyIHN0eWxlPXt7IGJhY2tncm91bmRDb2xvcjogXCIjZjJmNGY0XCIsIHRleHRBbGlnbjogXCJsZWZ0XCIgfX0+XG4gICAgICAgICAgICA8dGhcbiAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICBwYWRkaW5nOiBcIjhweCAxMnB4XCIsXG4gICAgICAgICAgICAgICAgYm9yZGVyQm90dG9tOiBcIjFweCBzb2xpZCAjY2NjXCIsXG4gICAgICAgICAgICAgIH19XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIENyaXRlcmlhXG4gICAgICAgICAgICA8L3RoPlxuICAgICAgICAgICAgPHRoXG4gICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgcGFkZGluZzogXCI4cHggMTJweFwiLFxuICAgICAgICAgICAgICAgIGJvcmRlckJvdHRvbTogXCIxcHggc29saWQgI2NjY1wiLFxuICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICBSYXRpbmdzXG4gICAgICAgICAgICA8L3RoPlxuICAgICAgICAgICAgPHRoXG4gICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgcGFkZGluZzogXCI4cHggMTJweFwiLFxuICAgICAgICAgICAgICAgIGJvcmRlckJvdHRvbTogXCIxcHggc29saWQgI2NjY1wiLFxuICAgICAgICAgICAgICAgIHRleHRBbGlnbjogXCJyaWdodFwiLFxuICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICBQdHNcbiAgICAgICAgICAgIDwvdGg+XG4gICAgICAgICAgPC90cj5cbiAgICAgICAgPC90aGVhZD5cbiAgICAgICAgPHRib2R5PlxuICAgICAgICAgIHtydWJyaWMubWFwKChjcml0LCBpZHgpID0+IChcbiAgICAgICAgICAgIDx0ciBrZXk9e2NyaXQuaWQgfHwgaWR4fSBzdHlsZT17eyBib3JkZXJCb3R0b206IFwiMXB4IHNvbGlkICNlOGVhZWNcIiB9fT5cbiAgICAgICAgICAgICAgPHRkXG4gICAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgIHBhZGRpbmc6IFwiMTBweCAxMnB4XCIsXG4gICAgICAgICAgICAgICAgICB2ZXJ0aWNhbEFsaWduOiBcInRvcFwiLFxuICAgICAgICAgICAgICAgICAgd2lkdGg6IFwiMzAlXCIsXG4gICAgICAgICAgICAgICAgICBib3JkZXJSaWdodDogXCIxcHggc29saWQgI2U4ZWFlY1wiLFxuICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0ncnVicmljLXBvcG92ZXItd3JhcHBlcic+XG4gICAgICAgICAgICAgICAgICA8c3Ryb25nPntjcml0LmRlc2NyaXB0aW9ufTwvc3Ryb25nPlxuICAgICAgICAgICAgICAgICAge2NyaXQubG9uZ19kZXNjcmlwdGlvbiAmJiAoXG4gICAgICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9J3J1YnJpYy1wb3BvdmVyJ1xuICAgICAgICAgICAgICAgICAgICAgIGRhbmdlcm91c2x5U2V0SW5uZXJIVE1MPXt7XG4gICAgICAgICAgICAgICAgICAgICAgICBfX2h0bWw6IGNyaXQubG9uZ19kZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICB7Y3JpdC5sb25nX2Rlc2NyaXB0aW9uICYmIChcbiAgICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgICAgICBmb250U2l6ZTogXCIxMnB4XCIsXG4gICAgICAgICAgICAgICAgICAgICAgY29sb3I6IFwiIzU5NmE3NVwiLFxuICAgICAgICAgICAgICAgICAgICAgIG1hcmdpblRvcDogXCI0cHhcIixcbiAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgZGFuZ2Vyb3VzbHlTZXRJbm5lckhUTUw9e3tcbiAgICAgICAgICAgICAgICAgICAgICBfX2h0bWw6IGNyaXQubG9uZ19kZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgPHRkIHN0eWxlPXt7IHBhZGRpbmc6IFwiMTBweCAxMnB4XCIsIHZlcnRpY2FsQWxpZ246IFwidG9wXCIgfX0+XG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiBcImZsZXhcIiwgZmxleFdyYXA6IFwid3JhcFwiLCBnYXA6IFwiOHB4XCIgfX0+XG4gICAgICAgICAgICAgICAgICB7QXJyYXkuaXNBcnJheShjcml0LnJhdGluZ3MpICYmXG4gICAgICAgICAgICAgICAgICAgIGNyaXQucmF0aW5ncy5tYXAoKHJhdGluZywgcklkeCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBvcG92ZXJUZXh0ID0gcmF0aW5nLmxvbmdfZGVzY3JpcHRpb24gfHwgcmF0aW5nLmRlc2NyaXB0aW9uO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGtleT17cmF0aW5nLmlkIHx8IHJJZHh9IGNsYXNzTmFtZT0ncnVicmljLXJhdGluZy1jYXJkJz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAge3BvcG92ZXJUZXh0ICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9J3J1YnJpYy1wb3BvdmVyJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGFuZ2Vyb3VzbHlTZXRJbm5lckhUTUw9e3tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgX19odG1sOiBwb3BvdmVyVGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250V2VpZ2h0OiBcImJvbGRcIiwgY29sb3I6IFwiIzAwODE0OFwiIH19PntyYXRpbmcucG9pbnRzfSBwdHM8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdj57cmF0aW5nLmRlc2NyaXB0aW9ufTwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfSl9XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgIDx0ZFxuICAgICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgICBwYWRkaW5nOiBcIjEwcHggMTJweFwiLFxuICAgICAgICAgICAgICAgICAgdmVydGljYWxBbGlnbjogXCJ0b3BcIixcbiAgICAgICAgICAgICAgICAgIHRleHRBbGlnbjogXCJyaWdodFwiLFxuICAgICAgICAgICAgICAgICAgZm9udFdlaWdodDogXCJib2xkXCIsXG4gICAgICAgICAgICAgICAgICB3aWR0aDogXCIxMCVcIixcbiAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAge2NyaXQucG9pbnRzfSBwdHNcbiAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgKSl9XG4gICAgICAgIDwvdGJvZHk+XG4gICAgICA8L3RhYmxlPlxuICAgIDwvZGl2PlxuICApO1xufVxuIiwiLyoqXG4gKiBBIGNvbXBvbmVudCB0aGF0IHJlbmRlcnMgYW4gYXNzaWdubWVudCBpY29uLlxuICogQGRlc2NyaXB0aW9uIFRoaXMgY29tcG9uZW50IGlzIHVzZWQgdG8gZGlzcGxheSBkaWZmZXJlbnQgaWNvbnMgYmFzZWQgb24gdGhlIHR5cGUgb2YgdGhlIGl0ZW0uIEZvdW5kIHBhdGhzIGF0OiBodHRwczovL2luc3RydWN0dXJlLmRlc2lnbi9sZWdhY3ktaWNvbnNcbiAqIEBwYXJhbSB7c3RyaW5nfSBpY29uX3R5cGUgLSBUaGUgdHlwZSBvZiB0aGUgaWNvbiB0byBkaXNwbGF5IChsb3dlcmNhc2UpLlxuICogSW5vZnJtYXRpb246ICBbJ0ZpbGUnIG9yICdQYWdlJyBvciAnRGlzY3Vzc2lvbicgb3IgJ0Fzc2lnbm1lbnQnIG9yICdRdWl6JyBvciAnU3ViSGVhZGVyJyBvciAnRXh0ZXJuYWxVcmwnIG9yICdFeHRlcm5hbFRvb2wnXVxuICogQHBhcmFtIHtPYmplY3R9IHByb3BzIC0gVGhlIGNvbXBvbmVudCBwcm9wcy5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gcHJvcHMuaXNNb2R1bGVJdGVtIC0gV2hldGhlciB0aGUgaWNvbiBpcyBmb3IgYSBtb2R1bGUgaXRlbS5cbiAqL1xuZnVuY3Rpb24gQ2FudmFzSXRlbUljb24oeyBpY29uX3R5cGUsIGlzTW9kdWxlSXRlbSB9KSB7XG4gIGZ1bmN0aW9uIGdldFBhdGhEYXRhKGljb25fdHlwZSkge1xuICAgIHN3aXRjaCAoaWNvbl90eXBlKSB7XG4gICAgICBjYXNlIFwiYXNzaWdubWVudFwiOlxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIDxwYXRoXG4gICAgICAgICAgICBkPSdNMTQ2OC4yMTQgMHY1NjQuNjk4aC0xMTIuOTRWMTEyLjk0SDExMi45NHYxNjk0LjA5MmgxMjQyLjMzNHYtMjI1Ljg3OWgxMTIuOTR2MzM4LjgxOUgwVjBoMTQ2OC4yMTRabTEyOS40MjggNTgxLjMxMWMyMi4xMzctMjIuMTM2IDU3LjgyNS0yMi4xMzYgNzkuOTYyIDBsMjI1Ljg3OSAyMjUuODc5YzIyLjAyMyAyMi4wMjMgMjIuMDIzIDU3LjcxMiAwIDc5Ljg0OGwtNjc3LjYzOCA2NzcuNjM3Yy0xMC42MTYgMTAuNTA0LTI0Ljk2IDE2LjQ5LTM5Ljk4IDE2LjQ5aC0yMjUuODhjLTMxLjE3IDAtNTYuNDY5LTI1LjI5OS01Ni40NjktNTYuNDd2LTIyNS44OGMwLTE1LjAyIDUuOTg2LTI5LjM2NCAxNi40OS0zOS44NjdabS0xNTUuMjkxIDMxNC45ODgtNDI1Ljg5NSA0MjUuODk1djE0Ni4wMzFoMTQ2LjAzbDQyNS44OTUtNDI1Ljg5NS0xNDYuMDMtMTQ2LjAzWm0tNzY0LjcxNCAzNDYuMDQ3djExMi45NEgzMzguODJ2LTExMi45NGgzMzguODE4Wm0yMjUuODgtMjI1Ljg4djExMi45NEgzMzguODE4di0xMTIuOTRoNTY0LjY5N1ptNzM0LjEwNi0zMTUuNDQtMTE1LjQyNCAxMTUuNDI1IDE0Ni4wMyAxNDYuMDMgMTE1LjQyNS0xMTUuNDIzLTE0Ni4wMzEtMTQ2LjAzMVpNMTEyOS4zOTUgMzM4LjgzdjQ1MS43NThIMzM4LjgyVjMzOC44M2g3OTAuNTc2Wm0tMTEyLjk0IDExMi45NEg0NTEuNzU5djIyNS44NzhoNTY0LjY5OFY0NTEuNzdaJ1xuICAgICAgICAgICAgZmlsbFJ1bGU9J2V2ZW5vZGQnXG4gICAgICAgICAgLz5cbiAgICAgICAgKTtcbiAgICAgIGNhc2UgXCJmaWxlXCI6IC8vIFwicGFwZXJjbGlwXCIgaXMgdGhlIGljb24gZm9yIGZpbGVzIGluIENhbnZhc1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIDxwYXRoXG4gICAgICAgICAgICBkPSdNMTc1Mi43NjggMjIxLjEwOUMxNTMyLjY0Ni45ODYgMTE3NC4yODMuOTg2IDk1NC4xNjEgMjIxLjEwOWwtODM4LjU4OCA4MzguNTg4Yy0xNTQuMDUyIDE1NC4xNjUtMTU0LjA1MiA0MDQuODk0IDAgNTU4Ljk0NiAxNDkuNTM0IDE0OS40MjEgNDA5Ljk3NiAxNDkuMzA4IDU1OS4wNTkgMGw3NTguNzM4LTc1OC42MjZjODcuOTgyLTg4LjA5NCA4Ny45ODItMjMxLjQxNyAwLTMxOS41MS04OC4zMi04OC4yMDgtMjMxLjY0Mi04Ny45ODItMzE5LjUxIDBsLTYzOC43OTYgNjM4LjkwOCA3OS44NSA3OS44NDkgNjM4Ljc5NS02MzguOTA4YzQzLjkzNC00My44MjEgMTE1LjUzOS00My45MzQgMTU5LjgxMiAwIDQzLjkzNCA0NC4wNDcgNDMuOTM0IDExNS44NzcgMCAxNTkuODEybC03NTguNzM5IDc1OC42MjVjLTExMC4yMyAxMTAuMTE4LTI4OS4zNTUgMTEwLjAwNS0zOTkuMzYgMC0xMTAuMTE4LTExMC4xMTctMTEwLjAwNS0yODkuMjQyIDAtMzk5LjI0N2w4MzguNTg4LTgzOC41ODhjMTc1Ljk2My0xNzUuOTYyIDQ2Mi4zODItMTc2LjE4OCA2MzguOTA5IDAgMTc2LjA3NSAxNzYuMTg4IDE3Ni4wNzUgNDYyLjgzMyAwIDYzOC45MDhsLTc5OC42MDcgNzk4LjcyIDc5Ljg0OSA3OS44NSA3OTguNjA3LTc5OC43MmMyMjAuMDEtMjIwLjEyMyAyMjAuMDEtNTc4LjQ4NSAwLTc5OC42MDcnXG4gICAgICAgICAgICBmaWxsUnVsZT0nZXZlbm9kZCdcbiAgICAgICAgICAvPlxuICAgICAgICApO1xuICAgICAgY2FzZSBcImRpc2N1c3Npb25cIjpcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8cGF0aFxuICAgICAgICAgICAgZD0nTTY3Ny42NDcgMTZ2MzM4LjkzNmgxMTIuOTQxVjEyOS4wNTRoMTAxNi40N1Y5MTkuNTNoLTIyNS45OTR2MjU5Ljc2NUwxMzIxLjQxMiA5MTkuNTNoLTc5LjE3MlY0NjcuODc4SDB2MTAxNi40N2gzMzguNzF2NDE4LjlsNDE3Ljk5Ni00MTguOWg0ODUuNTM0di00NTEuODc3aDMyLjc1M2w0MTkuMTI1IDQxOS4xMjR2LTQxOS4xMjRIMTkyMFYxNkg2NzcuNjQ3Wk0zMzguNzkgOTE5LjU2M2g1NjQuNzA2di0xMTIuOTRIMzM4Ljc5djExMi45NFptMCAyMjUuODgzaDMzOC45MzZ2LTExMy4wNTRIMzM4Ljc5djExMy4wNTRabS0yMjUuODUtNTY0Ljc0aDEwMTYuNDd2NzkwLjcwMUg3MTAuNEw0NTEuNjUyIDE2MzEuMDZ2LTI1OS42NTJoLTMzOC43MVY1ODAuNzA2WidcbiAgICAgICAgICAgIGZpbGxSdWxlPSdldmVub2RkJ1xuICAgICAgICAgIC8+XG4gICAgICAgICk7XG4gICAgICBjYXNlIFwiZXh0ZXJuYWx0b29sXCI6IC8vIFwiZXh0ZXJuYWx0b29sXCIgaXMgdGhlIGljb24gZm9yIGV4dGVybmFsIHRvb2xzIGluIENhbnZhc1xuICAgICAgY2FzZSBcImV4dGVybmFsdXJsXCI6IC8vIFwibGlua1wiIGlzIHRoZSBpY29uIGZvciBleHRlcm5hbCBsaW5rcyBpbiBDYW52YXNcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8cGF0aFxuICAgICAgICAgICAgZD0nTTE4NjYuMDAzIDM1MS41NjMgMTU2NS4xMjggNTAuNTc1Yy02OS40Ni02Ny42NTItMTgwLjkzMi02Ny40MjYtMjQ4LjkyMy41NjVMOTA2LjIzIDQ2MS4xMTZjLTY4LjMzIDY4LjQ0My02OC4zMyAxNzkuNjkuMTEzIDI0OC4xMzJsMzEuNjIzIDMxLjYyNCA3OS43MzctNzkuOTYzLTMxLjYyNC0zMS41MWMtMjQuMjgyLTI0LjM5Ni0yNC4yODItNjQuMDM4IDAtODguNDMzbDQwOS45NzctNDA5Ljk3N2MyNC41MDgtMjQuMzk1IDY0LjgyOC0yNC4xNyA4OS42NzUgMGwyOTkuODU5IDI5OS45NzJjMjQuNzM0IDI1LjE4NiAyNC44NDcgNjUuNjE5LjU2NCA5MC4wMTRsLTQwOS45NzYgNDA5Ljk3N2MtMjQuNTA4IDI0LjI4Mi02NC4xNSAyNC4yODItODguNTQ2IDBsLTExMC43OTUtMTEwLjkwOSAxNTkuNDczLTE1OS4zNi03OS44NS03OS44NS00MzUuNjE0IDQzNS41MDItMTA5Ljc3OS0xMDkuNzc5Yy0zMi44NjYtMzMuNjU2LTc2LjgtNTIuMjkyLTEyMy42Ny01Mi42My00My41OTYgMS42OTQtOTIuMjczIDE4LjI5Ni0xMjYuMTU2IDUyLjE3OEw1MS4zNzcgMTMxNi4wODFjLTY4LjQ0MiA2OC40NDItNjguNDQyIDE3OS42OSAwIDI0OC4xMzJsMzAxLjU1MyAzMDEuNTUzYzM0LjEwOCAzNC4xMDggNzkuMDU5IDUxLjI3NSAxMjQuMDEgNTEuMjc1IDQ0Ljk1IDAgODkuOS0xNy4xNjcgMTI0LjEyMi01MS4yNzVsNDA5Ljk3Ni00MDkuOTc3YzMzLjc3LTMzLjg4MiA1Mi40MDUtNzguNjA3IDUyLjA2Ni0xMjYuMDQyLS4yMjYtNDYuOTg0LTE4Ljk3NC05MC45MTgtNTIuMDY2LTEyMy4yMTlsLTMwLjQ5NC0zMC40OTQtNzkuODUgNzkuODUgMzAuOTQ2IDMwLjk0NWMxMS44NiAxMS42MzMgMTguNDEgMjcuMTA2IDE4LjUyMyA0My41OTUuMTEzIDE2Ljk0Mi02LjY2NCAzMy4wOTItMTguOTc0IDQ1LjUxNmwtNDA5Ljk3NyA0MDkuOTc2Yy0yMy40OTIgMjMuNDkyLTY0Ljk0IDIzLjQ5Mi04OC40MzMgMGwtMzAxLjU1My0zMDEuNTUzYy0xMS43NDYtMTEuNzQ2LTE4LjE4My0yNy40NDQtMTguMTgzLTQ0LjI3MyAwLTE2LjcxNSA2LjQzNy0zMi40MTQgMTguMTgzLTQ0LjE2bDQwOS45NzctNDA5Ljk3NmMxMi4xOTctMTIuMzEgMjguMjM1LTE5LjA4NyA0NS4wNjMtMTkuMDg3aC40NTJjMTYuNDkuMTEzIDMxLjk2MiA2LjY2MyA0My45MzQgMTkuMDg3bDExMC4zNDQgMTEwLjIzLTE2Mi4xODQgMTYyLjI5NyA3OS44NSA3OS44NSA0MzguMzI0LTQzOC40MzggMTEwLjc5NiAxMTAuOTA4YzM0LjMzNCAzNC4yMjEgNzkuMTcxIDUxLjI3NSAxMjQuMTIyIDUxLjI3NSA0NC45NSAwIDg5LjkwMS0xNy4wNTQgMTI0LjEyMi01MS4yNzVsNDA5Ljk3Ny00MDkuOTc3YzY3Ljg3Ny02Ny45OSA2Ny45OS0xNzkuNDYzIDAtMjQ5LjI2J1xuICAgICAgICAgICAgZmlsbFJ1bGU9J2V2ZW5vZGQnXG4gICAgICAgICAgLz5cbiAgICAgICAgKTtcbiAgICAgIGNhc2UgXCJwYWdlXCI6IC8vIFwiZG9jdW1lbnRcIiBpcyB0aGUgaWNvbiBmb3IgcGFnZXMgaW4gQ2FudmFzXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgIGQ9J00xNzA2LjIzNSAxODA3LjA1OUgzNTAuOTQxVjExMi45NGg5MDMuNTN2NDUxLjc2NWg0NTEuNzY0djEyNDIuMzUzWm0tMzM4LjgyMy0xNjcwLjc0IDMxNS40NDMgMzE1LjQ0N2gtMzE1LjQ0M1YxMzYuMzJabTQwMi4xODIgMjQyLjQ4N0wxNDQwLjM3MiA0OS41OEMxNDA4LjI5NiAxNy42MiAxMzY1LjcxNyAwIDEzMjAuNTQyIDBIMjM4djE5MjBoMTU4MS4xNzVWNDk4LjYzNWMwLTQ1LjE3Ni0xNy42MTgtODcuNzU1LTQ5LjU4LTExOS44M1pNNTc2LjgyMyAxMjQyLjM1M2g3OTAuNTg5di0xMTIuOTRINTc2LjgyM3YxMTIuOTRabTAtNDUxLjc2NWg5MDMuNTNWNjc3LjY0N2gtOTAzLjUzdjExMi45NDFabTAgNjc3LjY0N2g0NTEuNzY1di0xMTIuOTQxSDU3Ni44MjN2MTEyLjk0MVptMC00NTEuNzY0aDY3Ny42NDhWOTAzLjUzSDU3Ni44MjN2MTEyLjk0MVptMC00NTEuNzY1aDQ1MS43NjVWNDUxLjc2NUg1NzYuODIzdjExMi45NDFaJ1xuICAgICAgICAgICAgZmlsbFJ1bGU9J2V2ZW5vZGQnXG4gICAgICAgICAgLz5cbiAgICAgICAgKTtcbiAgICAgIGNhc2UgXCJxdWl6XCI6IC8vIGV4dGVybmFsdG9vbFxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIDxnIGZpbGxSdWxlPSdldmVub2RkJz5cbiAgICAgICAgICAgIDxwYXRoIGQ9J203NDYuMjU1IDE0NjYuNzY0IDgwLjQ4NCA4MC43MTItMjQ4Ljc0OCAyNDguNjM0LTgwLjQ4NC04MC41OTggMjQ4Ljc0OC0yNDguNzQ4Wm0tMTY1LjkwNC0xNjUuODM2IDgwLjU5OCA4MC41OTgtMzMxLjYyNiAzMzEuNjI2LTgwLjU5OC04MC41OTggMzMxLjYyNi0zMzEuNjI2Wm0tMTY1Ljg0Ny0xNjUuNzIxIDgwLjU5OCA4MC41OTgtNDE0LjUwNCA0MTQuNTA0TDAgMTU0OS43MWw0MTQuNTA0LTQxNC41MDRaTTExMTkuMzIgMjY0LjZjMzU2LjQ3OC0zNTYuNDc4IDcyNS4yNjgtMTc4LjI5NiA3MjkuMDMtMTc2LjQ3MmwxNy4xIDguNDM2IDguNDM2IDE3LjFjMS44MjQgMy42NDggMTgwLjAwNiAzNzIuNDM4LTE3Ni41ODYgNzI5LjAzbC0xNDYuNjA0IDE0Ni42MDQtMi42MjIgNjY1Ljg3NC0yMjIuNjQyIDIyMi42NDItMzMxLjYyNi0zMzEuNTEyLTU3OC4wOTQtNTc4LjA5NC0zMzEuNjI2LTMzMS43NCAyMjIuNjQyLTIyMi42NDIgNjY1Ljg3NC0yLjUwOFptMzE2LjkyIDgzOS4xNTQtMzYxLjgzNiAzNjEuOTUgMjUxLjAyOCAyNTAuOTE0IDEwOC44Ny0xMDguODcgMS45MzgtNTAzLjk5NFptMzQzLjAyNi05MjEuMzQ4Yy02OS4wODQtMjUuOTkyLTMyMS4zNjYtOTUuMzA0LTU3OS4zNDggMTYyLjc5MmwtNjIzLjAxIDYyMy4wMSA0MTYuODk4IDQxNi44OTggNjIyLjg5Ni02MjMuMDFjMjU2Ljk1Ni0yNTYuOTU2IDE4Ny45ODYtNTExLjE3NiAxNjIuNTY0LTU3OS42OVptLTkyMS4xMiAzNDMuMzY4LTUwMy45OTQgMS44MjQtMTA4Ljg3IDEwOC44N0w0OTYuMzEgODg3LjYxbDM2MS44MzYtMzYxLjgzNlonIC8+XG4gICAgICAgICAgICA8cGF0aCBkPSdNMTUzNC45ODcgMzcyLjU1OGMtNTEuMDcyLTEuMzY4LTEzMS42NyAxMi43NjgtMjEzLjI5NCA5NC4zOTJsLTQwLjQ3IDQwLjM1NiAxNzMuMzk0IDE3My4yOCA0MC4zNTYtNDAuMjQyYzgyLjE5NC04Mi4zMDggOTYuOS0xNjEuMzEgOTQuODQ4LTIxMy4xOGwtMi4xNjYtNTIuNTU0LTUyLjY2OC0yLjA1MlonIC8+XG4gICAgICAgICAgPC9nPlxuICAgICAgICApO1xuICAgICAgY2FzZSBcInN1YmhlYWRlclwiOiAvLyBUaGVyZSBpcyBubyBpY29uIGZvciBzdWJoZWFkZXJzIGluIENhbnZhcywgc28gd2UgcmV0dXJuIGFuIGVtcHR5IGZyYWdtZW50LCBhbGxvd2luZyBjc3MgdG8gZGlzcGxheTogbm9uZSB0aGUgcGFyZW50J3MgcGFyZW50IGRpdi5cbiAgICAgICAgcmV0dXJuIDw+PC8+O1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8cGF0aFxuICAgICAgICAgICAgZD0nTTE0NjguMjE0IDB2NTY0LjY5OGgtMTEyLjk0VjExMi45NEgxMTIuOTR2MTY5NC4wOTJoMTI0Mi4zMzR2LTIyNS44NzloMTEyLjk0djMzOC44MTlIMFYwaDE0NjguMjE0Wm0xMjkuNDI4IDU4MS4zMTFjMjIuMTM3LTIyLjEzNiA1Ny44MjUtMjIuMTM2IDc5Ljk2MiAwbDIyNS44NzkgMjI1Ljg3OWMyMi4wMjMgMjIuMDIzIDIyLjAyMyA1Ny43MTIgMCA3OS44NDhsLTY3Ny42MzggNjc3LjYzN2MtMTAuNjE2IDEwLjUwNC0yNC45NiAxNi40OS0zOS45OCAxNi40OWgtMjI1Ljg4Yy0zMS4xNyAwLTU2LjQ2OS0yNS4yOTktNTYuNDY5LTU2LjQ3di0yMjUuODhjMC0xNS4wMiA1Ljk4Ni0yOS4zNjQgMTYuNDktMzkuODY3Wm0tMTU1LjI5MSAzMTQuOTg4LTQyNS44OTUgNDI1Ljg5NXYxNDYuMDMxaDE0Ni4wM2w0MjUuODk1LTQyNS44OTUtMTQ2LjAzLTE0Ni4wM1ptLTc2NC43MTQgMzQ2LjA0N3YxMTIuOTRIMzM4Ljgydi0xMTIuOTRoMzM4LjgxOFptMjI1Ljg4LTIyNS44OHYxMTIuOTRIMzM4LjgxOHYtMTEyLjk0aDU2NC42OTdabTczNC4xMDYtMzE1LjQ0LTExNS40MjQgMTE1LjQyNSAxNDYuMDMgMTQ2LjAzIDExNS40MjUtMTE1LjQyMy0xNDYuMDMxLTE0Ni4wMzFaTTExMjkuMzk1IDMzOC44M3Y0NTEuNzU4SDMzOC44MlYzMzguODNoNzkwLjU3NlptLTExMi45NCAxMTIuOTRINDUxLjc1OXYyMjUuODc4aDU2NC42OThWNDUxLjc3WidcbiAgICAgICAgICAgIGZpbGxSdWxlPSdldmVub2RkJ1xuICAgICAgICAgIC8+XG4gICAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT0nY2FudmFzLWl0ZW0taWNvbic+XG4gICAgICA8c3ZnXG4gICAgICAgIHdpZHRoPScxNidcbiAgICAgICAgaGVpZ2h0PScxNidcbiAgICAgICAgdmlld0JveD0nMCAwIDE5MjAgMTkyMCdcbiAgICAgICAgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJ1xuICAgICAgICBzdHlsZT17eyBmaWxsOiBpc01vZHVsZUl0ZW0gPyBcIiMwMzg5M2RcIiA6IFwiIzQ3NTM1Y1wiIH19XG4gICAgICA+XG4gICAgICAgIHtnZXRQYXRoRGF0YShpY29uX3R5cGUpfVxuICAgICAgPC9zdmc+XG4gICAgPC9kaXY+XG4gICk7XG59XG4iLCIvKipcbiAqIFJlbmRlcnMgdGhlIHN1Ym1pc3Npb24gZm9yIGFuIGFzc2lnbm1lbnQuXG4gKiBAcGFyYW0ge09iamVjdH0gYXNzaWdubWVudCAtIFRoZSBhc3NpZ25tZW50IHRvIHJlbmRlciB0aGUgc3VibWlzc2lvbiBmb3IuXG4gKiBAcmV0dXJucyB7SlNYLkVsZW1lbnR8bnVsbH0gVGhlIHN1Ym1pc3Npb24gY29tcG9uZW50LlxuICovXG5mdW5jdGlvbiBDYW52YXNTdWJtaXNzaW9uKHsgYXNzaWdubWVudCB9KSB7XG4gIGNvbnN0IHsgZGlySGFuZGxlIH0gPSB1c2VDb3Vyc2VDb250ZXh0KCk7XG5cbiAgaWYgKCFhc3NpZ25tZW50IHx8ICFhc3NpZ25tZW50LnN1Ym1pc3Npb24pIHtcbiAgICByZXR1cm4gPGRpdiBzdHlsZT17eyBwYWRkaW5nOiBcIjFyZW1cIiwgY29sb3I6IFwiIzZiNzI4MFwiIH19Pk5vIHN1Ym1pc3Npb24gZGF0YSBhdmFpbGFibGUuPC9kaXY+O1xuICB9XG5cbiAgLy8gSWYgd2UgYXJlIGxvb2tpbmcgYXQgYW4gYXNzaWdubWVudCBidXQgaGF2ZW4ndCByZS1hdXRoZW50aWNhdGVkIHRoZSBmb2xkZXIgaGFuZGxlIHlldFxuICBpZiAoIWRpckhhbmRsZSkge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2XG4gICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgcGFkZGluZzogXCIxLjVyZW1cIixcbiAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiI2ZmZjNjZFwiLFxuICAgICAgICAgIGNvbG9yOiBcIiM4NTY0MDRcIixcbiAgICAgICAgICBib3JkZXI6IFwiMXB4IHNvbGlkICNmZmVlYmFcIixcbiAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiMC4yNXJlbVwiLFxuICAgICAgICAgIG1hcmdpblRvcDogXCIxcmVtXCIsXG4gICAgICAgIH19XG4gICAgICA+XG4gICAgICAgIDxzdHJvbmc+UGVybWlzc2lvbiBSZXF1aXJlZDo8L3N0cm9uZz4gV2UgbmVlZCBwZXJtaXNzaW9uIHRvIHJlYWQgeW91ciBsb2NhbCBmaWxlcyB0byBzaG93IHN1Ym1pc3Npb25zLiBQbGVhc2Ugc2VsZWN0IHlvdXIgZm9sZGVyXG4gICAgICAgIGZyb20gdGhlIERhc2hib2FyZCBhZ2Fpbi5cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH1cblxuICBjb25zdCB7IHN1Ym1pc3Npb24gfSA9IGFzc2lnbm1lbnQ7XG5cbiAgY29uc3QgcmVuZGVyU3VibWlzc2lvbkJvZHkgPSAoKSA9PiB7XG4gICAgc3dpdGNoIChzdWJtaXNzaW9uLnN1Ym1pc3Npb25fdHlwZSkge1xuICAgICAgY2FzZSBcIm9ubGluZV91cGxvYWRcIjpcbiAgICAgICAgaWYgKCFzdWJtaXNzaW9uLmF0dGFjaG1lbnRzIHx8IHN1Ym1pc3Npb24uYXR0YWNobWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIDxwIHN0eWxlPXt7IGNvbG9yOiBcIiM2YjcyODBcIiB9fT5ObyBmaWxlcyB3ZXJlIGF0dGFjaGVkIHRvIHRoaXMgc3VibWlzc2lvbi48L3A+O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgIHtzdWJtaXNzaW9uLmF0dGFjaG1lbnRzLm1hcCgoYXR0YWNobWVudCkgPT4gKFxuICAgICAgICAgICAgICA8TG9jYWxBdHRhY2htZW50Vmlld2VyIGtleT17YXR0YWNobWVudC5pZH0gYXR0YWNobWVudD17YXR0YWNobWVudH0gYXNzaWdubWVudD17YXNzaWdubWVudH0gLz5cbiAgICAgICAgICAgICkpfVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICApO1xuXG4gICAgICBjYXNlIFwib25saW5lX3RleHRfZW50cnlcIjpcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBwYWRkaW5nOiBcIjFyZW1cIixcbiAgICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcIiNmZmZcIixcbiAgICAgICAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCAjZTVlN2ViXCIsXG4gICAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCIwLjI1cmVtXCIsXG4gICAgICAgICAgICAgIGJveFNoYWRvdzogXCIwIDFweCAycHggcmdiYSgwLDAsMCwwLjA1KVwiLFxuICAgICAgICAgICAgICBvdmVyZmxvd1g6IFwiYXV0b1wiLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICAgIGRhbmdlcm91c2x5U2V0SW5uZXJIVE1MPXt7IF9faHRtbDogc3VibWlzc2lvbi5ib2R5IH19XG4gICAgICAgICAgLz5cbiAgICAgICAgKTtcblxuICAgICAgY2FzZSBcIm9ubGluZV91cmxcIjpcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBwYWRkaW5nOiBcIjFyZW1cIixcbiAgICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcIiNmZmZcIixcbiAgICAgICAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCAjZTVlN2ViXCIsXG4gICAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCIwLjI1cmVtXCIsXG4gICAgICAgICAgICAgIGJveFNoYWRvdzogXCIwIDFweCAycHggcmdiYSgwLDAsMCwwLjA1KVwiLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICA8cCBzdHlsZT17eyBtYXJnaW46IFwiMCAwIDAuNXJlbSAwXCIsIGNvbG9yOiBcIiM0YjU1NjNcIiB9fT5TdWJtaXR0ZWQgVVJMOjwvcD5cbiAgICAgICAgICAgIDxhXG4gICAgICAgICAgICAgIGhyZWY9e3N1Ym1pc3Npb24udXJsfVxuICAgICAgICAgICAgICB0YXJnZXQ9J19ibGFuaydcbiAgICAgICAgICAgICAgcmVsPSdub29wZW5lciBub3JlZmVycmVyJ1xuICAgICAgICAgICAgICBzdHlsZT17eyBjb2xvcjogXCIjMjU2M2ViXCIsIHRleHREZWNvcmF0aW9uOiBcIm5vbmVcIiwgd29yZEJyZWFrOiBcImJyZWFrLWFsbFwiIH19XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIHtzdWJtaXNzaW9uLnVybH1cbiAgICAgICAgICAgIDwvYT5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKTtcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBwYWRkaW5nOiBcIjFyZW1cIixcbiAgICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcIiNmZWZjZThcIixcbiAgICAgICAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCAjZmVmMDhhXCIsXG4gICAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCIwLjI1cmVtXCIsXG4gICAgICAgICAgICAgIGNvbG9yOiBcIiM4NTRkMGVcIixcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgPlxuICAgICAgICAgICAgVW5zdXBwb3J0ZWQgc3VibWlzc2lvbiB0eXBlOiB7c3VibWlzc2lvbi5zdWJtaXNzaW9uX3R5cGV9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICk7XG4gICAgfVxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPGRpdlxuICAgICAgc3R5bGU9e3tcbiAgICAgICAgbWF4V2lkdGg6IFwiNTZyZW1cIixcbiAgICAgICAgbWFyZ2luOiBcIjFlbSAwXCIsXG4gICAgICAgIHBhZGRpbmc6IFwiMS41cmVtXCIsXG4gICAgICAgIGJhY2tncm91bmRDb2xvcjogXCIjZjlmYWZiXCIsXG4gICAgICAgIGJvcmRlclJhZGl1czogXCI4cHhcIixcbiAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCAjZThlYWVjXCIsXG4gICAgICB9fVxuICAgID5cbiAgICAgIDxoZWFkZXIgc3R5bGU9e3sgbWFyZ2luQm90dG9tOiBcIjEuNXJlbVwiLCBib3JkZXJCb3R0b206IFwiMXB4IHNvbGlkICNlNWU3ZWJcIiwgcGFkZGluZ0JvdHRvbTogXCIxcmVtXCIgfX0+XG4gICAgICAgIDxoMyBzdHlsZT17eyBmb250U2l6ZTogXCIxLjI1cmVtXCIsIGZvbnRXZWlnaHQ6IFwiYm9sZFwiLCBjb2xvcjogXCIjMTExODI3XCIsIG1hcmdpbjogXCIwIDAgMC41cmVtIDBcIiB9fT5TdWJtaXNzaW9uPC9oMz5cbiAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiBcImZsZXhcIiwgZ2FwOiBcIjFyZW1cIiwgZm9udFNpemU6IFwiMC44NzVyZW1cIiwgY29sb3I6IFwiIzRiNTU2M1wiLCBmbGV4V3JhcDogXCJ3cmFwXCIgfX0+XG4gICAgICAgICAgPHAgc3R5bGU9e3sgbWFyZ2luOiAwIH19PlxuICAgICAgICAgICAgU3RhdHVzOiA8c3BhbiBzdHlsZT17eyBmb250V2VpZ2h0OiBcIjYwMFwiLCB0ZXh0VHJhbnNmb3JtOiBcImNhcGl0YWxpemVcIiB9fT57c3VibWlzc2lvbi53b3JrZmxvd19zdGF0ZX08L3NwYW4+XG4gICAgICAgICAgPC9wPlxuICAgICAgICAgIDxwIHN0eWxlPXt7IG1hcmdpbjogMCB9fT5TdWJtaXR0ZWQ6IHtuZXcgRGF0ZShzdWJtaXNzaW9uLnN1Ym1pdHRlZF9hdCkudG9Mb2NhbGVTdHJpbmcoKX08L3A+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9oZWFkZXI+XG5cbiAgICAgIDxzZWN0aW9uPntyZW5kZXJTdWJtaXNzaW9uQm9keSgpfTwvc2VjdGlvbj5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cbiIsIi8qKlxuICogQ29sbGFwc2libGUgVGFibGUgQ29tcG9uZW50XG4gKiBAcGFyYW0ge09iamVjdH0gcHJvcHNcbiAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wcy50aXRsZSAtIFRoZSB0aXRsZSBvZiB0aGUgY29sbGFwc2libGUgdGFibGUuXG4gKiBAcGFyYW0ge1JlYWN0LlJlYWN0Tm9kZX0gcHJvcHMuY2hpbGRyZW4gLSBUaGUgY29udGVudCB0byBiZSBkaXNwbGF5ZWQgaW5zaWRlLlxuICogQHBhcmFtIHtSZWFjdC5DU1NQcm9wZXJ0aWVzfSBwcm9wcy5zdHlsZSAtIFRoZSBzdHlsZSB0byBiZSBhcHBsaWVkIHRvIHRoZSBjb2xsYXBzaWJsZSB0YWJsZS5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gcHJvcHMuaXNNb2R1bGVJdGVtIC0gV2hldGhlciB0aGUgdGFibGUgaXMgYSBtb2R1bGUgaXRlbS5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gcHJvcHMuaXNPcGVuIC0gV2hldGhlciB0aGUgdGFibGUgaXMgb3Blbi5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IHByb3BzLm9uVG9nZ2xlIC0gVGhlIGZ1bmN0aW9uIHRvIGNhbGwgd2hlbiB0aGUgdGFibGUgaXMgdG9nZ2xlZC5cbiAqL1xuZnVuY3Rpb24gQ29sbGFwc2VUYWJsZSh7IHRpdGxlLCBjaGlsZHJlbiwgc3R5bGUsIGlzTW9kdWxlSXRlbSwgaXNPcGVuOiBjb250cm9sbGVkSXNPcGVuLCBvblRvZ2dsZSB9KSB7XG4gIC8vIEZhbGxiYWNrIGludGVybmFsIHN0YXRlIGZvciBzdGFuZGFsb25lIHVzYWdlIG91dHNpZGUgb2YgTW9kdWxlc1BhZ2VcbiAgY29uc3QgW2ludGVybmFsSXNPcGVuLCBzZXRJbnRlcm5hbElzT3Blbl0gPSB1c2VTdGF0ZSh0cnVlKTtcblxuICBjb25zdCBpc0NvbnRyb2xsZWQgPSB0eXBlb2YgY29udHJvbGxlZElzT3BlbiAhPT0gXCJ1bmRlZmluZWRcIjtcbiAgY29uc3QgaXNPcGVuID0gaXNDb250cm9sbGVkID8gY29udHJvbGxlZElzT3BlbiA6IGludGVybmFsSXNPcGVuO1xuXG4gIGNvbnN0IHRvZ2dsZU9wZW4gPSAoKSA9PiB7XG4gICAgaWYgKGlzQ29udHJvbGxlZCAmJiBvblRvZ2dsZSkge1xuICAgICAgb25Ub2dnbGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2V0SW50ZXJuYWxJc09wZW4oKHByZXYpID0+ICFwcmV2KTtcbiAgICB9XG4gIH07XG5cbiAgLy8gU2FmZSBub3JtYWxpemF0aW9uOiBDb252ZXJ0cyBzaW5nbGUgZWxlbWVudHMsIHN0cmluZ3MsIG9yIGFycmF5cyBpbnRvIGEgY2xlYW4gYXJyYXlcbiAgY29uc3QgY2hpbGRMaXN0ID0gUmVhY3QuQ2hpbGRyZW4udG9BcnJheShjaGlsZHJlbik7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT0nY29sbGFwc2UtdGFibGUnIHN0eWxlPXtzdHlsZX0+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT0nY29sbGFwc2UtdGFibGUtaGVhZGVyJyBvbkNsaWNrPXt0b2dnbGVPcGVufT5cbiAgICAgICAgPHNwYW5cbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgZm9udFNpemU6IFwiMTBweFwiLFxuICAgICAgICAgICAgbWFyZ2luTGVmdDogXCIxMnB4XCIsXG4gICAgICAgICAgICBkaXNwbGF5OiBcImlubGluZS1ibG9ja1wiLFxuICAgICAgICAgICAgdHJhbnNmb3JtOiBcInNjYWxlWSguNzUpXCIsXG4gICAgICAgICAgICB0cmFuc2Zvcm1PcmlnaW46IFwibWlkZGxlXCIsXG4gICAgICAgICAgfX1cbiAgICAgICAgPlxuICAgICAgICAgIHshaXNPcGVuID8gXCLilrJcIiA6IFwi4pa8XCJ9XG4gICAgICAgIDwvc3Bhbj5cbiAgICAgICAgPHNwYW4+e3RpdGxlfTwvc3Bhbj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICB7aXNPcGVuICYmIChcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9J2NvbGxhcHNlLXRhYmxlLWNvbnRlbnQnPlxuICAgICAgICAgIHtjaGlsZExpc3QubGVuZ3RoID4gMCA/IChcbiAgICAgICAgICAgIDx1bCBjbGFzc05hbWU9J2NvbGxhcHNlLXRhYmxlLWxpc3QnPlxuICAgICAgICAgICAgICB7Y2hpbGRMaXN0Lm1hcCgoY2hpbGQsIGluZGV4KSA9PiAoXG4gICAgICAgICAgICAgICAgPGxpXG4gICAgICAgICAgICAgICAgICBrZXk9e2NoaWxkLmtleSB8fCBpbmRleH1cbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT0nY29sbGFwc2UtdGFibGUtaXRlbSdcbiAgICAgICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgICAgIGJvcmRlckxlZnQ6IGlzTW9kdWxlSXRlbSA/IFwiNHB4IHNvbGlkICMwMzg5M2RcIiA6IFwiMXB4IHNvbGlkICNlOGVhZWNcIixcbiAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAge2NoaWxkfVxuICAgICAgICAgICAgICAgIDwvbGk+XG4gICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgPC91bD5cbiAgICAgICAgICApIDogKFxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J2NvbGxhcHNlLXRhYmxlLWVtcHR5Jz5ObyBpdGVtcyB0byBkaXNwbGF5LjwvZGl2PlxuICAgICAgICAgICl9XG4gICAgICAgIDwvZGl2PlxuICAgICAgKX1cbiAgICA8L2Rpdj5cbiAgKTtcbn1cbi8qKlxuICogUmVuZGVycyB0aGUgZGV0YWlscyBvZiBhIGxpc3QgaXRlbSBpbiBhIGNvbGxhcHNpYmxlIHRhYmxlLiBOb3Qgc3VyZSB3aHkgdGhlcmUgYXJlIHNvIG1hbnkgcHJvcHMuLi4gd2FzIG9uZSBvZiB0aGUgZmlyc3QgY29tcG9uZW50cy5cbiAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wcy50aXRsZSAtIFRoZSB0aXRsZSBvZiB0aGUgbGlzdCBpdGVtLlxuICogQHBhcmFtIHtib29sZWFufSBwcm9wcy5jbG9zZWQgLSBXaGV0aGVyIHRoZSBsaXN0IGl0ZW0gaXMgY2xvc2VkLlxuICogQHBhcmFtIHtzdHJpbmd9IHByb3BzLmR1ZURhdGUgLSBUaGUgZHVlIGRhdGUgb2YgdGhlIGxpc3QgaXRlbS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wcy5ncmFkZSAtIFRoZSBncmFkZSBvZiB0aGUgbGlzdCBpdGVtLlxuICogQHBhcmFtIHtzdHJpbmd9IHByb3BzLm1heEdyYWRlIC0gVGhlIG1heGltdW0gZ3JhZGUgb2YgdGhlIGxpc3QgaXRlbS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wcy5hc3NpZ25tZW50IC0gVGhlIGFzc2lnbm1lbnQgb2YgdGhlIGxpc3QgaXRlbS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wcy5wYWdlVXJsIC0gVGhlIHBhZ2UgVVJMIG9mIHRoZSBsaXN0IGl0ZW0uXG4gKiBAcGFyYW0ge2Jvb2xlYW59IHByb3BzLmlzTW9kdWxlSXRlbSAtIFdoZXRoZXIgdGhlIGxpc3QgaXRlbSBpcyBhIG1vZHVsZSBpdGVtLlxuICogQHBhcmFtIHtzdHJpbmd9IHByb3BzLnR5cGUgLSBUaGUgdHlwZSBvZiB0aGUgbGlzdCBpdGVtLlxuICogQHBhcmFtIHtudW1iZXJ9IHByb3BzLmluZGVudCAtIFRoZSBpbmRlbnQgb2YgdGhlIGxpc3QgaXRlbS5cbiAqL1xuZnVuY3Rpb24gQ29sbGFwc2VMaXN0SXRlbURldGFpbHMoeyB0aXRsZSwgY2xvc2VkLCBkdWVEYXRlLCBncmFkZSwgbWF4R3JhZGUsIGFzc2lnbm1lbnQsIHBhZ2VVcmwsIGlzTW9kdWxlSXRlbSwgdHlwZSwgaW5kZW50IH0pIHtcbiAgICAgIGNvbnN0IHsgbmF2aWdhdGVUb0Fzc2lnbm1lbnQsIG5hdmlnYXRlVG9QYWdlIH0gPSB1c2VOYXZpZ2F0aW9uKCk7XG4gICAgICBjb25zdCB7IHJlY29ubmVjdEZvbGRlciB9ID0gdXNlQ291cnNlQ29udGV4dCgpO1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgPGRpdlxuICAgICAgICAgIGNsYXNzTmFtZT0nYXNzaWdubWVudC1kZXRhaWxzJ1xuICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICAgIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsXG4gICAgICAgICAgICBwYWRkaW5nTGVmdDogYCR7aW5kZW50ICogMX1lbWAsXG4gICAgICAgICAgfX1cbiAgICAgICAgPlxuICAgICAgICAgIDxDYW52YXNJdGVtSWNvbiBpY29uX3R5cGU9e3R5cGU/LnRvTG93ZXJDYXNlKCl9IGlzTW9kdWxlSXRlbT17aXNNb2R1bGVJdGVtfSAvPlxuICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgIGNsYXNzTmFtZT0nYXNzaWdubWVudC1pbmZvJ1xuICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsXG4gICAgICAgICAgICAgIGZsZXhEaXJlY3Rpb246IFwiY29sdW1uXCIsXG4gICAgICAgICAgICAgIG1hcmdpbkxlZnQ6IFwiMGVtXCIsXG4gICAgICAgICAgICB9fVxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxoM1xuICAgICAgICAgICAgICBjbGFzc05hbWU9J2Fzc2lnbm1lbnQtaW5mby10aXRsZSdcbiAgICAgICAgICAgICAgc3R5bGU9e3sgZm9udFNpemU6IFwiMTZweFwiLCBtYXJnaW46IFwiMFwiLCBjb2xvcjogXCIjMjczNDUwXCIsIGN1cnNvcjogYXNzaWdubWVudCB8fCBwYWdlVXJsID8gXCJwb2ludGVyXCIgOiBcImRlZmF1bHRcIiB9fVxuICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVjb25uZWN0Rm9sZGVyKCk7XG4gICAgICAgICAgICAgICAgaWYgKGFzc2lnbm1lbnQ/LmlkKSB7XG4gICAgICAgICAgICAgICAgICBuYXZpZ2F0ZVRvQXNzaWdubWVudChhc3NpZ25tZW50LmlkKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHBhZ2VVcmwpIHtcbiAgICAgICAgICAgICAgICAgIG5hdmlnYXRlVG9QYWdlKHBhZ2VVcmwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAge3RpdGxlfVxuICAgICAgICAgICAgPC9oMz5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogYXNzaWdubWVudCAhPSB1bmRlZmluZWQgPyBcImluaGVyaXRcIiA6IFwibm9uZVwiIH19PlxuICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9J2Fzc2lnbm1lbnQtaW5mby1pdGVtJz5cbiAgICAgICAgICAgICAgICA8c3Ryb25nPntjbG9zZWQgPyBcIkNsb3NlZFwiIDogXCJPcGVuXCJ9PC9zdHJvbmc+XG4gICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPSdhc3NpZ25tZW50LWluZm8taXRlbSc+XG4gICAgICAgICAgICAgICAgPHN0cm9uZz5EdWU8L3N0cm9uZz4ge2R1ZURhdGV9XG4gICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgeyFhc3NpZ25tZW50Py5zdWJtaXNzaW9uX3R5cGVzPy5pbmNsdWRlcyhcIm5vbmVcIikgJiYgYXNzaWdubWVudD8uZ3JhZGluZ190eXBlID09IFwicG9pbnRzXCIgJiYgZ3JhZGUgJiYgbWF4R3JhZGUgJiYgKFxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT0nYXNzaWdubWVudC1pbmZvLWl0ZW0nPlxuICAgICAgICAgICAgICAgICAgPHN0cm9uZz57Z3JhZGV9PC9zdHJvbmc+L3ttYXhHcmFkZX0gcHRzXG4gICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgKTtcbiAgICB9XG4iLCIvKipcbiAqIFRha2VzIGEgdHlwZSBvZiBbXCJtaXNzaW5nXCIsIFwibGF0ZVwiXVxuICogcmV0dXJucyBhIHNwYW4gd2l0aCB0aGUgYXBwcm9wcmlhdGUgY29sb3IgYW5kIHRleHQgZm9yIHRoZSBjb250ZXh0IHBpbGwuXG4gKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFRoZSB0eXBlIG9mIGNvbnRleHQgcGlsbCB0byBkaXNwbGF5LlxuICogQHJldHVybnMge1JlYWN0LkNvbXBvbmVudH0gZWl0aGVyIHN0eWxlZCBtaXNzaW5nIG9yIGxhdGVcbiAqL1xuZnVuY3Rpb24gQ29udGV4dFBpbGwoeyB0eXBlIH0pIHtcbiAgY29uc3QgY29tbW9uU3R5bGVzID0ge1xuICAgIHBhZGRpbmc6IFwiMnB4IDZweFwiLFxuICAgIGJvcmRlclJhZGl1czogXCI0cHhcIixcbiAgICBmb250U2l6ZTogXCIxNHB4XCIsXG4gICAgZm9udFdlaWdodDogXCJsaWdodFwiLFxuICAgIHRleHRUcmFuc2Zvcm06IFwibG93ZXJjYXNlXCIsXG4gICAgYm9yZGVyUmFkaXVzOiBcIjk5OXJlbVwiLFxuICB9O1xuICBsZXQgYm9yZGVyQ29sb3IgPSB0eXBlID09PSBcIm1pc3NpbmdcIiA/IFwicmdiKDIzMCwgMzYsIDQxKVwiIDogdHlwZSA9PT0gXCJsYXRlXCIgPyBcInJnYig0MywgMTIyLCAxODgpXCIgOiBcIiNlMmUzZTVcIjtcbiAgbGV0IHRleHRDb2xvciA9IHR5cGUgPT09IFwibWlzc2luZ1wiID8gXCJyZ2IoMjMwLCAzNiwgNDEpXCIgOiB0eXBlID09PSBcImxhdGVcIiA/IFwicmdiKDQzLCAxMjIsIDE4OClcIiA6IFwiIzM4M2Q0MVwiO1xuXG4gIHJldHVybiAoXG4gICAgPHNwYW5cbiAgICAgIHN0eWxlPXt7XG4gICAgICAgIC4uLmNvbW1vblN0eWxlcyxcbiAgICAgICAgYm9yZGVyOiBgMXB4IHNvbGlkICR7Ym9yZGVyQ29sb3J9YCxcbiAgICAgICAgY29sb3I6IHRleHRDb2xvcixcbiAgICAgIH19XG4gICAgPlxuICAgICAge3R5cGV9XG4gICAgPC9zcGFuPlxuICApO1xufVxuIiwiLyoqXG4gKiBDb3Vyc2VMaXN0IGNvbXBvbmVudCB0aGF0IGRpc3BsYXlzIGEgbGlzdCBvZiBjb3Vyc2UgZWxlbWVudHMuIEl0IGNoZWNrcyBpZiB0aGUgZWxlbWVudHMgcHJvcCBpcyB2YWxpZCBhbmQgcmVuZGVycyBhIGxpc3Qgb2YgbGlua3MgdG8gdGhlIGNvdXJzZSBpdGVtcy5cbiAqIGVsZW1lbnRzOiB7a2V5OiBzdHJpbmcsIHRpdGxlOiBzdHJpbmd9W11cbiAqIGFjdGl2ZUtleTogc3RyaW5nXG4gKiBjYWxsYmFjazogZnVuY3Rpb25cbiAqL1xuZnVuY3Rpb24gQ291cnNlTGlzdCh7IGVsZW1lbnRzLCBhY3RpdmVLZXksIGNhbGxiYWNrIH0pIHtcbiAgaWYgKCFlbGVtZW50cyB8fCBlbGVtZW50cz8ubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgbGV0IGNvdXJzZVN1YnRpdGxlID0gXCJDb3Vyc2UgTWVudVwiO1xuICBjb25zdCB7IGNvdXJzZURhdGEgfSA9IHVzZUNvdXJzZUNvbnRleHQoKTtcblxuICBpZiAoY291cnNlRGF0YSkge1xuICAgIGNvdXJzZVN1YnRpdGxlID0gY291cnNlRGF0YT8ubWFuaWZlc3Q/LmNvdXJzZVRlcm0/Lm5hbWUgfHwgXCJDb3Vyc2UgTWVudVwiO1xuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICBjbGFzc05hbWU9J2NvdXJzZS1pdGVtLWxpc3QnXG4gICAgICBpZD0nY291cnNlX2l0ZW1fbGlzdCdcbiAgICAgIHN0eWxlPXt7XG4gICAgICAgIHBvc2l0aW9uOiBcInN0aWNreVwiLCAvLyBNYWtlcyBpdCBzdGlja3lcbiAgICAgICAgdG9wOiBcIjBweFwiLCAvLyBEaXN0YW5jZSBmcm9tIHRvcCBvZiBzY3JlZW4gd2hlbiBzY3JvbGxpbmdcbiAgICAgICAgbWF4SGVpZ2h0OiBcImNhbGMoMTAwdmggLSA0MHB4KVwiLCAvLyBPcHRpb25hbDogS2VlcHMgbG9uZyBtZW51cyBzY3JvbGxhYmxlIHdpdGhpbiB2aWV3cG9ydFxuICAgICAgICBvdmVyZmxvd1k6IFwiYXV0b1wiLCAvLyBPcHRpb25hbDogQWxsb3dzIHNjcm9sbGluZyBpbnNpZGUgc2lkZWJhciBpZiBtZW51IGlzIGxvbmdcbiAgICAgICAgZmxleFNocmluazogMCwgLy8gUHJldmVudHMgY29udGVudCBvbiB0aGUgcmlnaHQgZnJvbSBzcXVpc2hpbmcgdGhlIHNpZGViYXJcbiAgICAgICAgbWF4V2lkdGg6IFwiMTkycHhcIixcbiAgICAgIH19XG4gICAgPlxuICAgICAgPGRpdlxuICAgICAgICBjbGFzc05hbWU9J2NvdXNlX3N1YnRpdGxlJ1xuICAgICAgICBzdHlsZT17e1xuICAgICAgICAgIGZvbnRTaXplOiBcIjExcHhcIixcbiAgICAgICAgICBvdmVyZmxvdzogXCJoaWRkZW5cIixcbiAgICAgICAgICB0ZXh0T3ZlcmZsb3c6IFwiZWxsaXBzaXNcIixcbiAgICAgICAgICB3aGl0ZVNwYWNlOiBcIm5vd3JhcFwiLFxuICAgICAgICAgIG1hcmdpbjogXCIzZW0gMWVtIDBlbSAxLjVlbVwiLFxuICAgICAgICAgIHBhZGRpbmdSaWdodDogXCIxZW1cIixcbiAgICAgICAgICBjb2xvcjogXCIjMjczNTQwXCIsXG4gICAgICAgIH19XG4gICAgICA+XG4gICAgICAgIDxpPntjb3Vyc2VTdWJ0aXRsZX08L2k+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxuYXY+XG4gICAgICAgIDx1bCBpZD0nY291cnNlTGlzdCcgc3R5bGU9e3sgZGlzcGxheTogXCJibG9ja1wiLCBsaXN0U3R5bGU6IFwibm9uZVwiLCBwYWRkaW5nOiAwIH19PlxuICAgICAgICAgIHtlbGVtZW50cy5tYXAoKGVsZW1lbnQsIGluZGV4KSA9PiAoXG4gICAgICAgICAgICA8bGkgY2xhc3NOYW1lPXtgY291cnNlLWl0ZW0gJHthY3RpdmVLZXkgPT09IGVsZW1lbnQua2V5ID8gXCJhY3RpdmUtY291cnNlLWl0ZW1cIiA6IFwiXCJ9YH0ga2V5PXtlbGVtZW50LmtleSB8fCBpbmRleH0+XG4gICAgICAgICAgICAgIDxhXG4gICAgICAgICAgICAgICAgb25DbGljaz17KGUpID0+IHtcbiAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICAgIGhhbmRsZUNvdXJzZUl0ZW1DbGljayhlbGVtZW50LmtleSwgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgaHJlZj0nIydcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIHtlbGVtZW50LnRpdGxlfVxuICAgICAgICAgICAgICA8L2E+XG4gICAgICAgICAgICA8L2xpPlxuICAgICAgICAgICkpfVxuICAgICAgICA8L3VsPlxuICAgICAgPC9uYXY+XG4gICAgPC9kaXY+XG4gICk7XG59XG5cbi8qKlxuICogSGFuZGxlQ291cnNlSXRlbUNsaWNrIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIHdoZW4gYSBjb3Vyc2UgaXRlbSBpcyBjbGlja2VkLiBDdXJyZW50bHksIGl0IGRvZXMgbm90aGluZyBidXQgY2FuIGJlIGV4dGVuZGVkIHRvIGhhbmRsZSBuYXZpZ2F0aW9uIG9yIG90aGVyIGFjdGlvbnMuXG4gKiBrZXk6IHN0cmluZ1xuICogY2FsbGJhY2s6IGZ1bmN0aW9uXG4gKi9cbmZ1bmN0aW9uIGhhbmRsZUNvdXJzZUl0ZW1DbGljayhrZXksIGNhbGxiYWNrKSB7XG4gIGNvbnNvbGUubG9nKFwiQ291cnNlIGl0ZW0gY2xpY2tlZDpcIiwga2V5KTtcbiAgaWYgKGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2soa2V5KTtcbiAgfVxufVxuIiwiLyoqXG4gKiBDb3Vyc2UgcGlja2VyIGRpYWxvZyB0aGF0IGFsbG93cyB0aGUgdXNlciB0byBzZWxlY3QgYSBjb3Vyc2UgZm9sZGVyIGFuZCBsb2FkIHRoZSBjb3Vyc2UgZGF0YS4gVXRpbGl6ZXMgdGhlIENvdXJzZUNvbnRleHQgdG8gbWFuYWdlIHRoZSBjb3Vyc2UgZGF0YSBhbmQgcHJvY2Vzc2luZyBzdGF0ZS5cbiAqL1xuZnVuY3Rpb24gQ291cnNlUGlja2VyKCkge1xuICBjb25zdCB7IGhhbmRsZUZvbGRlclNlbGVjdCwgaXNQcm9jZXNzaW5nIH0gPSB1c2VDb3Vyc2VDb250ZXh0KCk7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT0nY291cnNlLXBpY2tlcic+XG4gICAgICA8aDE+V2VsY29tZSB0byB0aGUgT2ZmbGluZSBDb3Vyc2UgVmlld2VyPC9oMT5cbiAgICAgIDxwPlBsZWFzZSBzZWxlY3QgYSBjb3Vyc2UgZm9sZGVyIHRvIGJlZ2luLiBUaGUgZm9sZGVyIHNob3VsZCBjb250YWluIHRoZSBjb3Vyc2UgY29udGVudCBhbmQgbWV0YWRhdGEuPC9wPlxuICAgICAgPGJ1dHRvbiBvbkNsaWNrPXtoYW5kbGVGb2xkZXJTZWxlY3R9IGRpc2FibGVkPXtpc1Byb2Nlc3Npbmd9PlxuICAgICAgICB7aXNQcm9jZXNzaW5nID8gXCJQcm9jZXNzaW5nLi4uXCIgOiBcIlNlbGVjdCBDb3Vyc2UgRm9sZGVyXCJ9XG4gICAgICA8L2J1dHRvbj5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cbiIsIi8qKlxuICogVXNlcyBtYW1tb3RoIHRvIGNvbnZlcnQgZG9jIGFuZCBkb2N4IHRvIGxvY2FsIGF0dGF0Y2htZW50c1xuICogQHBhcmFtIHsqfSBmaWxlT2JqZWN0IC0gVGhlIGZpbGUgb2JqZWN0IHRvIGNvbnZlcnQuXG4gKiBAcGFyYW0geyp9IGZpbGVVcmwgLSBUaGUgVVJMIG9mIHRoZSBmaWxlIHRvIGNvbnZlcnQuXG4gKiBAcmV0dXJucyBUaGUgZG9jeCB2aWV3ZXIgY29tcG9uZW50IGZvciB0aGUgYXNzaWdubWVudC5cbiAqL1xuZnVuY3Rpb24gRG9jeE1lbW9yeVZpZXdlcih7IGZpbGVPYmplY3QsIGZpbGVVcmwgfSkge1xuICBjb25zdCBbaHRtbENvbnRlbnQsIHNldEh0bWxDb250ZW50XSA9IHVzZVN0YXRlKFwiXCIpO1xuICBjb25zdCBbbG9hZGluZywgc2V0TG9hZGluZ10gPSB1c2VTdGF0ZSh0cnVlKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGFzeW5jIGZ1bmN0aW9uIGNvbnZlcnREb2N4KCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgbGV0IGFycmF5QnVmZmVyID0gbnVsbDtcbiAgICAgICAgaWYgKGZpbGVPYmplY3QpIHtcbiAgICAgICAgICBhcnJheUJ1ZmZlciA9IGF3YWl0IGZpbGVPYmplY3QuYXJyYXlCdWZmZXIoKTtcbiAgICAgICAgfSBlbHNlIGlmIChmaWxlVXJsKSB7XG4gICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goZmlsZVVybCk7XG4gICAgICAgICAgYXJyYXlCdWZmZXIgPSBhd2FpdCByZXMuYXJyYXlCdWZmZXIoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWFycmF5QnVmZmVyKSByZXR1cm47XG4gICAgICAgIC8vIENvbnZlcnRzIGJpbmFyeSAuZG9jeCBkaXJlY3RseSB0byByYXcgSFRNTCBzdHJpbmdcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgd2luZG93Lm1hbW1vdGguY29udmVydFRvSHRtbCh7IGFycmF5QnVmZmVyIH0pO1xuICAgICAgICBzZXRIdG1sQ29udGVudChyZXN1bHQudmFsdWUpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJGYWlsZWQgdG8gcGFyc2UgZG9jeFwiLCBlcnIpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgc2V0TG9hZGluZyhmYWxzZSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChmaWxlT2JqZWN0IHx8IGZpbGVVcmwpIGNvbnZlcnREb2N4KCk7XG4gIH0sIFtmaWxlT2JqZWN0LCBmaWxlVXJsXSk7XG5cbiAgaWYgKGxvYWRpbmcpIHJldHVybiA8ZGl2PlBhcnNpbmcgZG9jdW1lbnQuLi48L2Rpdj47XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICBzdHlsZT17e1xuICAgICAgICBwYWRkaW5nOiBcIjEuNXJlbVwiLFxuICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiI2ZmZlwiLFxuICAgICAgICBib3JkZXI6IFwiMXB4IHNvbGlkICNlNWU3ZWJcIixcbiAgICAgICAgYm9yZGVyUmFkaXVzOiBcIjAuMjVyZW1cIixcbiAgICAgICAgbWF4SGVpZ2h0OiBcIjMwcmVtXCIsXG4gICAgICAgIG92ZXJmbG93WTogXCJhdXRvXCIsXG4gICAgICAgIHdpZHRoOiBcIjEwMCVcIixcbiAgICAgIH19XG4gICAgICBkYW5nZXJvdXNseVNldElubmVySFRNTD17eyBfX2h0bWw6IGh0bWxDb250ZW50IH19XG4gICAgLz5cbiAgKTtcbn0iLCIvKiogU3ViLWNvbXBvbmVudCB0byBoYW5kbGUgYXN5bmNocm9ub3VzIGZpbGUgbG9hZGluZyBhbmQgbWVtb3J5IGNsZWFudXBcbiAqIEBwYXJhbSB7T2JqZWN0fSBhdHRhY2htZW50IC0gVGhlIGF0dGFjaG1lbnQgb2JqZWN0XG4gKiBAcGFyYW0ge09iamVjdH0gYXNzaWdubWVudCAtIFRoZSBhc3NpZ25tZW50IG9iamVjdFxuICogQHBhcmFtIHtPYmplY3R9IGZpbGUgLSBUaGUgZmlsZSBvYmplY3RcbiAqIEByZXR1cm5zIHtSZWFjdC5Db21wb25lbnR9IFRoZSBsb2NhbCBhdHRhY2htZW50IHZpZXdlclxuICovXG5mdW5jdGlvbiBMb2NhbEF0dGFjaG1lbnRWaWV3ZXIoeyBhdHRhY2htZW50LCBhc3NpZ25tZW50LCBmaWxlIH0pIHtcbiAgY29uc3QgeyBkaXJIYW5kbGUsIGNvdXJzZURhdGEgfSA9IHVzZUNvdXJzZUNvbnRleHQoKTtcbiAgY29uc3QgW2ZpbGVVcmwsIHNldEZpbGVVcmxdID0gdXNlU3RhdGUobnVsbCk7XG4gIGNvbnN0IFtmaWxlT2JqZWN0LCBzZXRGaWxlT2JqZWN0XSA9IHVzZVN0YXRlKG51bGwpO1xuICBjb25zdCBbZXJyb3IsIHNldEVycm9yXSA9IHVzZVN0YXRlKG51bGwpO1xuICBjb25zdCBbaXNMb2FkaW5nLCBzZXRJc0xvYWRpbmddID0gdXNlU3RhdGUodHJ1ZSk7XG5cbiAgY29uc3QgdGFyZ2V0RmlsZSA9IGZpbGUgfHwgYXR0YWNobWVudDtcbiAgY29uc3QgcmF3RmlsZU5hbWUgPSB0YXJnZXRGaWxlID8gdGFyZ2V0RmlsZS5kaXNwbGF5X25hbWUgfHwgdGFyZ2V0RmlsZS5maWxlbmFtZSB8fCBcIlwiIDogXCJcIjtcbiAgY29uc3Qgc2FuaXRpemVkQXNzaWdubWVudE5hbWUgPSBhc3NpZ25tZW50ID8gc2FuaXRpemVGaWxlbmFtZShhc3NpZ25tZW50Lm5hbWUpIDogXCJcIjtcbiAgY29uc3Qgc2FuaXRpemVkRmlsZU5hbWUgPSBzYW5pdGl6ZUZpbGVuYW1lKHJhd0ZpbGVOYW1lKTtcblxuICAvLyBGZXRjaCB0aGUgZmlsZSBmcm9tIHRoZSBGaWxlIFN5c3RlbSBBUEkgYW5kIGNyZWF0ZSBhIHJlYWRhYmxlIFVSTFxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghdGFyZ2V0RmlsZSkge1xuICAgICAgc2V0RXJyb3IoXCJObyBmaWxlIHNwZWNpZmllZC5cIik7XG4gICAgICBzZXRJc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghZGlySGFuZGxlKSB7XG4gICAgICBzZXRFcnJvcihcIk5vIGRpcmVjdG9yeSBhY2Nlc3MuXCIpO1xuICAgICAgc2V0SXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsZXQgb2JqZWN0VXJsID0gbnVsbDtcblxuICAgIGFzeW5jIGZ1bmN0aW9uIGxvYWRMb2NhbEZpbGUoKSB7XG4gICAgICB0cnkge1xuICAgICAgICBzZXRJc0xvYWRpbmcodHJ1ZSk7XG4gICAgICAgIHNldEVycm9yKG51bGwpO1xuXG4gICAgICAgIGlmICghZGlySGFuZGxlKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gZGlyZWN0b3J5IGFjY2VzcyBoYW5kbGUgYXZhaWxhYmxlLlwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBtYXRjaGVkRmlsZUhhbmRsZSA9IG51bGw7XG5cbiAgICAgICAgaWYgKGFzc2lnbm1lbnQpIHtcbiAgICAgICAgICAvLyAxLiBBY2Nlc3MgdGhlIFwiU3VibWlzc2lvbnNcIiBkaXJlY3RvcnlcbiAgICAgICAgICBjb25zdCBzdWJtaXNzaW9uc0hhbmRsZSA9IGF3YWl0IGRpckhhbmRsZS5nZXREaXJlY3RvcnlIYW5kbGUoXCJTdWJtaXNzaW9uc1wiKTtcblxuICAgICAgICAgIC8vIFRhcmdldHMgZm9yIGFzc2lnbm1lbnQgZm9sZGVyXG4gICAgICAgICAgY29uc3QgdGFyZ2V0Rm9sZGVyU2FuaXRpemVkID0gc2FuaXRpemVGaWxlbmFtZShhc3NpZ25tZW50Lm5hbWUpLnRvTG93ZXJDYXNlKCkudHJpbSgpO1xuICAgICAgICAgIGNvbnN0IHRhcmdldEZvbGRlclJhdyA9IChhc3NpZ25tZW50Lm5hbWUgfHwgXCJcIikudG9Mb3dlckNhc2UoKS50cmltKCk7XG5cbiAgICAgICAgICBsZXQgYXNzaWdubWVudEhhbmRsZSA9IG51bGw7XG5cbiAgICAgICAgICAvLyAyLiBGSU5EIEFTU0lHTk1FTlQgRk9MREVSXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGFzc2lnbm1lbnRIYW5kbGUgPSBhd2FpdCBzdWJtaXNzaW9uc0hhbmRsZS5nZXREaXJlY3RvcnlIYW5kbGUodGFyZ2V0Rm9sZGVyU2FuaXRpemVkKTtcbiAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgZW50cnkgb2Ygc3VibWlzc2lvbnNIYW5kbGUudmFsdWVzKCkpIHtcbiAgICAgICAgICAgICAgaWYgKGVudHJ5LmtpbmQgPT09IFwiZGlyZWN0b3J5XCIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmb2xkZXJOYW1lID0gZW50cnkubmFtZS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICBjb25zdCBmb2xkZXJTYW5pdGl6ZWQgPSBzYW5pdGl6ZUZpbGVuYW1lKGVudHJ5Lm5hbWUpLnRvTG93ZXJDYXNlKCkudHJpbSgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgZm9sZGVyTmFtZSA9PT0gdGFyZ2V0Rm9sZGVyUmF3IHx8XG4gICAgICAgICAgICAgICAgICBmb2xkZXJOYW1lID09PSB0YXJnZXRGb2xkZXJTYW5pdGl6ZWQgfHxcbiAgICAgICAgICAgICAgICAgIGZvbGRlclNhbml0aXplZCA9PT0gdGFyZ2V0Rm9sZGVyU2FuaXRpemVkIHx8XG4gICAgICAgICAgICAgICAgICBmb2xkZXJOYW1lLmluY2x1ZGVzKHRhcmdldEZvbGRlclNhbml0aXplZCkgfHxcbiAgICAgICAgICAgICAgICAgIHRhcmdldEZvbGRlclNhbml0aXplZC5pbmNsdWRlcyhmb2xkZXJOYW1lKVxuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgYXNzaWdubWVudEhhbmRsZSA9IGVudHJ5O1xuICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKCFhc3NpZ25tZW50SGFuZGxlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2lnbm1lbnQgZm9sZGVyIG5vdCBmb3VuZCBmb3I6IFwiJHthc3NpZ25tZW50Lm5hbWV9XCJgKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBQcmVwYXJlIHRhcmdldCBmaWxlIHN0cmluZ3NcbiAgICAgICAgICBjb25zdCByYXdUYXJnZXQgPSAodGFyZ2V0RmlsZS5kaXNwbGF5X25hbWUgfHwgdGFyZ2V0RmlsZS5maWxlbmFtZSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcbiAgICAgICAgICBjb25zdCBzYW5pdGl6ZWRUYXJnZXQgPSBzYW5pdGl6ZUZpbGVuYW1lKHJhd1RhcmdldCkudG9Mb3dlckNhc2UoKS50cmltKCk7XG4gICAgICAgICAgY29uc3QgY3VycmVudEF0dGVtcHROdW1iZXIgPSBhc3NpZ25tZW50Py5zdWJtaXNzaW9uPy5hdHRlbXB0O1xuXG4gICAgICAgICAgY29uc3QgZXhwZWN0ZWRBdHRlbXB0UHJlZml4ID0gY3VycmVudEF0dGVtcHROdW1iZXIgPyBgYXR0ZW1wdCAke2N1cnJlbnRBdHRlbXB0TnVtYmVyfSAtIGAgOiBudWxsO1xuICAgICAgICAgIGNvbnN0IGF0dGVtcHRQcmVmaXhSZWdleCA9IC9eYXR0ZW1wdFxccytcXGQrXFxzKi1cXHMqL2k7XG5cbiAgICAgICAgICAvLyAzLiBTRUFSQ0ggRk9SIEFUVEFDSE1FTlQgRklMRSBJTiBBU1NJR05NRU5UIEZPTERFUlxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgZW50cnkgb2YgYXNzaWdubWVudEhhbmRsZS52YWx1ZXMoKSkge1xuICAgICAgICAgICAgaWYgKGVudHJ5LmtpbmQgPT09IFwiZmlsZVwiKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGRpc2tOYW1lUmF3ID0gZW50cnkubmFtZS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcbiAgICAgICAgICAgICAgY29uc3QgZGlza05hbWVTYW5pdGl6ZWQgPSBzYW5pdGl6ZUZpbGVuYW1lKGVudHJ5Lm5hbWUpLnRvTG93ZXJDYXNlKCkudHJpbSgpO1xuXG4gICAgICAgICAgICAgIGNvbnN0IGRpc2tOYW1lVW5wcmVmaXhlZFJhdyA9IGRpc2tOYW1lUmF3LnJlcGxhY2UoYXR0ZW1wdFByZWZpeFJlZ2V4LCBcIlwiKS50cmltKCk7XG4gICAgICAgICAgICAgIGNvbnN0IGRpc2tOYW1lVW5wcmVmaXhlZFNhbml0aXplZCA9IHNhbml0aXplRmlsZW5hbWUoZGlza05hbWVVbnByZWZpeGVkUmF3KS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcblxuICAgICAgICAgICAgICBjb25zdCBtYXRjaGVzRXhhY3RBdHRlbXB0UHJlZml4ID0gZXhwZWN0ZWRBdHRlbXB0UHJlZml4ICYmIGRpc2tOYW1lUmF3LnN0YXJ0c1dpdGgoZXhwZWN0ZWRBdHRlbXB0UHJlZml4KTtcblxuICAgICAgICAgICAgICBjb25zdCBpc01hdGNoID1cbiAgICAgICAgICAgICAgICAobWF0Y2hlc0V4YWN0QXR0ZW1wdFByZWZpeCAmJiBkaXNrTmFtZVVucHJlZml4ZWRTYW5pdGl6ZWQgPT09IHNhbml0aXplZFRhcmdldCkgfHxcbiAgICAgICAgICAgICAgICBkaXNrTmFtZVJhdyA9PT0gcmF3VGFyZ2V0IHx8XG4gICAgICAgICAgICAgICAgZGlza05hbWVSYXcgPT09IHNhbml0aXplZFRhcmdldCB8fFxuICAgICAgICAgICAgICAgIGRpc2tOYW1lU2FuaXRpemVkID09PSBzYW5pdGl6ZWRUYXJnZXQgfHxcbiAgICAgICAgICAgICAgICBkaXNrTmFtZVVucHJlZml4ZWRSYXcgPT09IHJhd1RhcmdldCB8fFxuICAgICAgICAgICAgICAgIGRpc2tOYW1lVW5wcmVmaXhlZFJhdyA9PT0gc2FuaXRpemVkVGFyZ2V0IHx8XG4gICAgICAgICAgICAgICAgZGlza05hbWVVbnByZWZpeGVkU2FuaXRpemVkID09PSBzYW5pdGl6ZWRUYXJnZXQgfHxcbiAgICAgICAgICAgICAgICBkaXNrTmFtZVVucHJlZml4ZWRSYXcucmVwbGFjZSgvXFwrL2csIFwiIFwiKSA9PT0gcmF3VGFyZ2V0IHx8XG4gICAgICAgICAgICAgICAgKGRpc2tOYW1lUmF3LmluY2x1ZGVzKHNhbml0aXplZFRhcmdldCkgJiYgZGlza05hbWVSYXcuZW5kc1dpdGgoc2FuaXRpemVkVGFyZ2V0LnNsaWNlKC01KSkpO1xuXG4gICAgICAgICAgICAgIGlmIChpc01hdGNoKSB7XG4gICAgICAgICAgICAgICAgbWF0Y2hlZEZpbGVIYW5kbGUgPSBlbnRyeTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICghbWF0Y2hlZEZpbGVIYW5kbGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRmlsZSBcIiR7cmF3VGFyZ2V0fVwiIG5vdCBmb3VuZCBpbiBmb2xkZXIgXCIke2Fzc2lnbm1lbnRIYW5kbGUubmFtZX1cImApO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyAtLS0gQ09VUlNFIEZJTEUgKEZpbGVzLy4uLikgTE9PS1VQIC0tLVxuICAgICAgICAgIGNvbnN0IGZpbGVzSGFuZGxlID0gYXdhaXQgZGlySGFuZGxlLmdldERpcmVjdG9yeUhhbmRsZShcIkZpbGVzXCIpO1xuXG4gICAgICAgICAgLy8gRGV0ZXJtaW5lIHN1YmZvbGRlciBwYXRoIGZyb20gZm9sZGVyX2lkIGluIGNvdXJzZURhdGEuRmlsZXMuZm9sZGVyc1xuICAgICAgICAgIGxldCBmb2xkZXJQYXRoUGFydHMgPSBbXTtcbiAgICAgICAgICBpZiAodGFyZ2V0RmlsZS5mb2xkZXJfaWQgJiYgY291cnNlRGF0YT8uRmlsZXM/LmZvbGRlcnMpIHtcbiAgICAgICAgICAgIGNvbnN0IGZvbGRlcnNBcnJheSA9IEFycmF5LmlzQXJyYXkoY291cnNlRGF0YS5GaWxlcy5mb2xkZXJzKVxuICAgICAgICAgICAgICA/IGNvdXJzZURhdGEuRmlsZXMuZm9sZGVyc1xuICAgICAgICAgICAgICA6IE9iamVjdC52YWx1ZXMoY291cnNlRGF0YS5GaWxlcy5mb2xkZXJzKTtcbiAgICAgICAgICAgIGNvbnN0IGZvbGRlck1hcCA9IG5ldyBNYXAoZm9sZGVyc0FycmF5Lm1hcCgoZikgPT4gW1N0cmluZyhmLmlkKSwgZl0pKTtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVGb2xkZXIgPSBmb2xkZXJNYXAuZ2V0KFN0cmluZyh0YXJnZXRGaWxlLmZvbGRlcl9pZCkpO1xuXG4gICAgICAgICAgICBpZiAoZmlsZUZvbGRlciAmJiBmaWxlRm9sZGVyLmZ1bGxfbmFtZSkge1xuICAgICAgICAgICAgICBsZXQgZm4gPSBmaWxlRm9sZGVyLmZ1bGxfbmFtZTtcbiAgICAgICAgICAgICAgaWYgKGZuLnRvTG93ZXJDYXNlKCkuc3RhcnRzV2l0aChcImNvdXJzZSBmaWxlc1wiKSkge1xuICAgICAgICAgICAgICAgIGZuID0gZm4uc2xpY2UoXCJjb3Vyc2UgZmlsZXNcIi5sZW5ndGgpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZvbGRlclBhdGhQYXJ0cyA9IGZuXG4gICAgICAgICAgICAgICAgLnNwbGl0KFwiL1wiKVxuICAgICAgICAgICAgICAgIC5tYXAoKHMpID0+IHMudHJpbSgpKVxuICAgICAgICAgICAgICAgIC5maWx0ZXIoQm9vbGVhbik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGZpbGVGb2xkZXIpIHtcbiAgICAgICAgICAgICAgY29uc3QgcGFydHMgPSBbXTtcbiAgICAgICAgICAgICAgbGV0IGN1cnIgPSBmaWxlRm9sZGVyO1xuICAgICAgICAgICAgICB3aGlsZSAoY3VyciAmJiBjdXJyLnBhcmVudF9mb2xkZXJfaWQgIT09IG51bGwgJiYgY3Vyci5uYW1lICE9PSBcImNvdXJzZSBmaWxlc1wiKSB7XG4gICAgICAgICAgICAgICAgcGFydHMudW5zaGlmdChjdXJyLm5hbWUpO1xuICAgICAgICAgICAgICAgIGN1cnIgPSBmb2xkZXJNYXAuZ2V0KFN0cmluZyhjdXJyLnBhcmVudF9mb2xkZXJfaWQpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmb2xkZXJQYXRoUGFydHMgPSBwYXJ0cztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBUcmF2ZXJzZSBpbnRvIHRhcmdldCBmb2xkZXIgaWYgc3BlY2lmaWVkXG4gICAgICAgICAgbGV0IHRhcmdldERpckhhbmRsZSA9IGZpbGVzSGFuZGxlO1xuICAgICAgICAgIGZvciAoY29uc3QgcGFydCBvZiBmb2xkZXJQYXRoUGFydHMpIHtcbiAgICAgICAgICAgIGxldCBuZXh0SGFuZGxlID0gbnVsbDtcbiAgICAgICAgICAgIGNvbnN0IHBhcnRSYXcgPSBwYXJ0LnRvTG93ZXJDYXNlKCkudHJpbSgpO1xuICAgICAgICAgICAgY29uc3QgcGFydFNhbml0aXplZCA9IHNhbml0aXplRmlsZW5hbWUocGFydCkudG9Mb3dlckNhc2UoKS50cmltKCk7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIG5leHRIYW5kbGUgPSBhd2FpdCB0YXJnZXREaXJIYW5kbGUuZ2V0RGlyZWN0b3J5SGFuZGxlKHBhcnQpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIG5leHRIYW5kbGUgPSBhd2FpdCB0YXJnZXREaXJIYW5kbGUuZ2V0RGlyZWN0b3J5SGFuZGxlKHNhbml0aXplRmlsZW5hbWUocGFydCkpO1xuICAgICAgICAgICAgICB9IGNhdGNoIChlMikge1xuICAgICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgZW50cnkgb2YgdGFyZ2V0RGlySGFuZGxlLnZhbHVlcygpKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoZW50cnkua2luZCA9PT0gXCJkaXJlY3RvcnlcIikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlbnRyeVJhdyA9IGVudHJ5Lm5hbWUudG9Mb3dlckNhc2UoKS50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVudHJ5U2FuaXRpemVkID0gc2FuaXRpemVGaWxlbmFtZShlbnRyeS5uYW1lKS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVudHJ5UmF3ID09PSBwYXJ0UmF3IHx8IGVudHJ5U2FuaXRpemVkID09PSBwYXJ0U2FuaXRpemVkIHx8IGVudHJ5U2FuaXRpemVkID09PSBzYW5pdGl6ZUZpbGVuYW1lKHBhcnRSYXcpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgbmV4dEhhbmRsZSA9IGVudHJ5O1xuICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChuZXh0SGFuZGxlKSB7XG4gICAgICAgICAgICAgIHRhcmdldERpckhhbmRsZSA9IG5leHRIYW5kbGU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCByYXdUYXJnZXQgPSAodGFyZ2V0RmlsZS5kaXNwbGF5X25hbWUgfHwgdGFyZ2V0RmlsZS5maWxlbmFtZSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcbiAgICAgICAgICBjb25zdCBzYW5pdGl6ZWRUYXJnZXQgPSBzYW5pdGl6ZUZpbGVuYW1lKHJhd1RhcmdldCkudG9Mb3dlckNhc2UoKS50cmltKCk7XG5cbiAgICAgICAgICAvLyBTZWFyY2ggaW5zaWRlIHRhcmdldERpckhhbmRsZVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgZW50cnkgb2YgdGFyZ2V0RGlySGFuZGxlLnZhbHVlcygpKSB7XG4gICAgICAgICAgICBpZiAoZW50cnkua2luZCA9PT0gXCJmaWxlXCIpIHtcbiAgICAgICAgICAgICAgY29uc3QgZGlza05hbWVSYXcgPSBlbnRyeS5uYW1lLnRvTG93ZXJDYXNlKCkudHJpbSgpO1xuICAgICAgICAgICAgICBjb25zdCBkaXNrTmFtZVNhbml0aXplZCA9IHNhbml0aXplRmlsZW5hbWUoZW50cnkubmFtZSkudG9Mb3dlckNhc2UoKS50cmltKCk7XG4gICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICBkaXNrTmFtZVJhdyA9PT0gcmF3VGFyZ2V0IHx8XG4gICAgICAgICAgICAgICAgZGlza05hbWVSYXcgPT09IHNhbml0aXplZFRhcmdldCB8fFxuICAgICAgICAgICAgICAgIGRpc2tOYW1lU2FuaXRpemVkID09PSBzYW5pdGl6ZWRUYXJnZXQgfHxcbiAgICAgICAgICAgICAgICBkaXNrTmFtZVJhdy5yZXBsYWNlKC9cXCsvZywgXCIgXCIpID09PSByYXdUYXJnZXQgfHxcbiAgICAgICAgICAgICAgICBkaXNrTmFtZVNhbml0aXplZC5yZXBsYWNlKC9cXCsvZywgXCIgXCIpID09PSBzYW5pdGl6ZWRUYXJnZXRcbiAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgbWF0Y2hlZEZpbGVIYW5kbGUgPSBlbnRyeTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEZhbGxiYWNrIDE6IFNlYXJjaCB0b3AtbGV2ZWwgRmlsZXMgZGlyZWN0b3J5IGlmIHRhcmdldERpckhhbmRsZSB3YXMgYSBzdWJmb2xkZXJcbiAgICAgICAgICBpZiAoIW1hdGNoZWRGaWxlSGFuZGxlICYmIHRhcmdldERpckhhbmRsZSAhPT0gZmlsZXNIYW5kbGUpIHtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgZW50cnkgb2YgZmlsZXNIYW5kbGUudmFsdWVzKCkpIHtcbiAgICAgICAgICAgICAgaWYgKGVudHJ5LmtpbmQgPT09IFwiZmlsZVwiKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGlza05hbWVSYXcgPSBlbnRyeS5uYW1lLnRvTG93ZXJDYXNlKCkudHJpbSgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGRpc2tOYW1lU2FuaXRpemVkID0gc2FuaXRpemVGaWxlbmFtZShlbnRyeS5uYW1lKS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICBkaXNrTmFtZVJhdyA9PT0gcmF3VGFyZ2V0IHx8XG4gICAgICAgICAgICAgICAgICBkaXNrTmFtZVJhdyA9PT0gc2FuaXRpemVkVGFyZ2V0IHx8XG4gICAgICAgICAgICAgICAgICBkaXNrTmFtZVNhbml0aXplZCA9PT0gc2FuaXRpemVkVGFyZ2V0IHx8XG4gICAgICAgICAgICAgICAgICBkaXNrTmFtZVJhdy5yZXBsYWNlKC9cXCsvZywgXCIgXCIpID09PSByYXdUYXJnZXRcbiAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgIG1hdGNoZWRGaWxlSGFuZGxlID0gZW50cnk7XG4gICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBGYWxsYmFjayAyOiBSZWN1cnNpdmUgc2VhcmNoIHVuZGVyIGZpbGVzSGFuZGxlIGlmIHN0aWxsIG5vdCBmb3VuZFxuICAgICAgICAgIGlmICghbWF0Y2hlZEZpbGVIYW5kbGUpIHtcbiAgICAgICAgICAgIGFzeW5jIGZ1bmN0aW9uIGZpbmRSZWN1cnNpdmUoZGlyKSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgZW50cnkgb2YgZGlyLnZhbHVlcygpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVudHJ5LmtpbmQgPT09IFwiZmlsZVwiKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBkaXNrTmFtZVJhdyA9IGVudHJ5Lm5hbWUudG9Mb3dlckNhc2UoKS50cmltKCk7XG4gICAgICAgICAgICAgICAgICBjb25zdCBkaXNrTmFtZVNhbml0aXplZCA9IHNhbml0aXplRmlsZW5hbWUoZW50cnkubmFtZSkudG9Mb3dlckNhc2UoKS50cmltKCk7XG4gICAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAgIGRpc2tOYW1lUmF3ID09PSByYXdUYXJnZXQgfHxcbiAgICAgICAgICAgICAgICAgICAgZGlza05hbWVSYXcgPT09IHNhbml0aXplZFRhcmdldCB8fFxuICAgICAgICAgICAgICAgICAgICBkaXNrTmFtZVNhbml0aXplZCA9PT0gc2FuaXRpemVkVGFyZ2V0IHx8XG4gICAgICAgICAgICAgICAgICAgIGRpc2tOYW1lUmF3LnJlcGxhY2UoL1xcKy9nLCBcIiBcIikgPT09IHJhd1RhcmdldFxuICAgICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBlbnRyeTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGVudHJ5LmtpbmQgPT09IFwiZGlyZWN0b3J5XCIpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGZvdW5kID0gYXdhaXQgZmluZFJlY3Vyc2l2ZShlbnRyeSk7XG4gICAgICAgICAgICAgICAgICBpZiAoZm91bmQpIHJldHVybiBmb3VuZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBtYXRjaGVkRmlsZUhhbmRsZSA9IGF3YWl0IGZpbmRSZWN1cnNpdmUoZmlsZXNIYW5kbGUpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICghbWF0Y2hlZEZpbGVIYW5kbGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRmlsZSBcIiR7cmF3VGFyZ2V0fVwiIG5vdCBmb3VuZCBpbiBGaWxlcyBkaXJlY3RvcnkuYCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gNC4gUmV0cmlldmUgRmlsZSBPYmplY3RcbiAgICAgICAgY29uc3QgbG9hZGVkRmlsZSA9IGF3YWl0IG1hdGNoZWRGaWxlSGFuZGxlLmdldEZpbGUoKTtcbiAgICAgICAgc2V0RmlsZU9iamVjdChsb2FkZWRGaWxlKTtcblxuICAgICAgICAvLyA1LiBDcmVhdGUgT2JqZWN0IFVSTFxuICAgICAgICBvYmplY3RVcmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGxvYWRlZEZpbGUpO1xuICAgICAgICBzZXRGaWxlVXJsKG9iamVjdFVybCk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBDb3VsZCBub3QgbG9hZCBsb2NhbCBmaWxlOiBcIiR7cmF3RmlsZU5hbWV9XCJgLCBlcnIpO1xuICAgICAgICBzZXRFcnJvcihlcnIubWVzc2FnZSB8fCBcIkZpbGUgb3IgZGlyZWN0b3J5IG5vdCBmb3VuZCBsb2NhbGx5LlwiKTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHNldElzTG9hZGluZyhmYWxzZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbG9hZExvY2FsRmlsZSgpO1xuXG4gICAgLy8gQ1JJVElDQUw6IFByZXZlbnQgbWVtb3J5IGxlYWtzIGJ5IHJldm9raW5nIHRoZSBVUkwgd2hlbiB0aGUgY29tcG9uZW50IHVubW91bnRzXG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGlmIChvYmplY3RVcmwpIHtcbiAgICAgICAgVVJMLnJldm9rZU9iamVjdFVSTChvYmplY3RVcmwpO1xuICAgICAgfVxuICAgIH07XG4gIH0sIFtkaXJIYW5kbGUsIGNvdXJzZURhdGEsIHNhbml0aXplZEFzc2lnbm1lbnROYW1lLCBzYW5pdGl6ZWRGaWxlTmFtZSwgdGFyZ2V0RmlsZT8uaWQsIHRhcmdldEZpbGU/LmZvbGRlcl9pZF0pO1xuXG4gIGNvbnN0IG1pbWVDbGFzcyA9IGdldE1pbWVDbGFzcyh0YXJnZXRGaWxlKTtcbiAgY29uc3QgZm9ybWF0dGVkU2l6ZSA9IHRhcmdldEZpbGU/LnNpemUgPyAodGFyZ2V0RmlsZS5zaXplIC8gMTAyNCkudG9GaXhlZCgxKSArIFwiIEtCXCIgOiBcIi1cIjtcblxuICBpZiAoaXNMb2FkaW5nKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXZcbiAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICBwYWRkaW5nOiBcIjFyZW1cIixcbiAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiI2YzZjRmNlwiLFxuICAgICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgI2U1ZTdlYlwiLFxuICAgICAgICAgIGJvcmRlclJhZGl1czogXCIwLjI1cmVtXCIsXG4gICAgICAgICAgbWFyZ2luQm90dG9tOiBcIjFyZW1cIixcbiAgICAgICAgfX1cbiAgICAgID5cbiAgICAgICAgTG9hZGluZyB7cmF3RmlsZU5hbWV9Li4uXG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG5cbiAgaWYgKGVycm9yKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXZcbiAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICBwYWRkaW5nOiBcIjFyZW1cIixcbiAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiI2ZlZjJmMlwiLFxuICAgICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgI2ZlY2FjYVwiLFxuICAgICAgICAgIGNvbG9yOiBcIiM5OTFiMWJcIixcbiAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiMC4yNXJlbVwiLFxuICAgICAgICAgIG1hcmdpbkJvdHRvbTogXCIxcmVtXCIsXG4gICAgICAgIH19XG4gICAgICA+XG4gICAgICAgIHtlcnJvcn0gKHtzYW5pdGl6ZWRGaWxlTmFtZX0pXG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG5cbiAgbGV0IGNvbnRlbnQ7XG4gIHN3aXRjaCAobWltZUNsYXNzKSB7XG4gICAgY2FzZSBcImltYWdlXCI6XG4gICAgICBjb250ZW50ID0gKFxuICAgICAgICA8aW1nXG4gICAgICAgICAgc3JjPXtmaWxlVXJsfVxuICAgICAgICAgIGFsdD17cmF3RmlsZU5hbWV9XG4gICAgICAgICAgc3R5bGU9e3sgbWF4V2lkdGg6IFwiMTAwJVwiLCBoZWlnaHQ6IFwiYXV0b1wiLCBib3JkZXI6IFwiMXB4IHNvbGlkICNlNWU3ZWJcIiwgYm9yZGVyUmFkaXVzOiBcIjAuMjVyZW1cIiB9fVxuICAgICAgICAvPlxuICAgICAgKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSBcInZpZGVvXCI6XG4gICAgICBjb250ZW50ID0gKFxuICAgICAgICA8dmlkZW8gY29udHJvbHMgc3R5bGU9e3sgd2lkdGg6IFwiMTAwJVwiLCBtYXhXaWR0aDogXCI0MnJlbVwiLCBib3JkZXI6IFwiMXB4IHNvbGlkICNlNWU3ZWJcIiwgYm9yZGVyUmFkaXVzOiBcIjAuMjVyZW1cIiB9fT5cbiAgICAgICAgICA8c291cmNlIHNyYz17ZmlsZVVybH0gLz5cbiAgICAgICAgICBZb3VyIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCB0aGUgdmlkZW8gdGFnLlxuICAgICAgICA8L3ZpZGVvPlxuICAgICAgKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSBcInBkZlwiOlxuICAgIGNhc2UgXCJ0ZXh0XCI6XG4gICAgY2FzZSBcImh0bWxcIjpcbiAgICAgIGNvbnRlbnQgPSAoXG4gICAgICAgIDxpZnJhbWVcbiAgICAgICAgICBzcmM9e2ZpbGVVcmx9XG4gICAgICAgICAgdGl0bGU9e3Jhd0ZpbGVOYW1lfVxuICAgICAgICAgIHN0eWxlPXt7IHdpZHRoOiBcIjEwMCVcIiwgaGVpZ2h0OiBcIjI0cmVtXCIsIGJvcmRlcjogXCIxcHggc29saWQgI2U1ZTdlYlwiLCBib3JkZXJSYWRpdXM6IFwiMC4yNXJlbVwiLCBiYWNrZ3JvdW5kQ29sb3I6IFwiI2ZmZlwiIH19XG4gICAgICAgIC8+XG4gICAgICApO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlIFwiZG9jXCI6XG4gICAgICAvLyBSZW5kZXIgLmRvY3ggZGlyZWN0bHkgdG8gSFRNTCBpbiBtZW1vcnkhXG4gICAgICBjb250ZW50ID0gPERvY3hNZW1vcnlWaWV3ZXIgZmlsZU9iamVjdD17ZmlsZU9iamVjdH0gZmlsZVVybD17ZmlsZVVybH0gLz47XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwicHB0XCI6XG4gICAgICBjb250ZW50ID0gPFBwdHhNZW1vcnlWaWV3ZXIgZmlsZU9iamVjdD17ZmlsZU9iamVjdH0gZmlsZVVybD17ZmlsZVVybH0gLz47XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwieGxzXCI6XG4gICAgICBjb250ZW50ID0gKFxuICAgICAgICA8ZGl2XG4gICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgIHBhZGRpbmc6IFwiMnJlbVwiLFxuICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcIiNmOWZhZmJcIixcbiAgICAgICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgI2U1ZTdlYlwiLFxuICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiBcIjAuMjVyZW1cIixcbiAgICAgICAgICAgIHRleHRBbGlnbjogXCJjZW50ZXJcIixcbiAgICAgICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICAgICAgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIixcbiAgICAgICAgICAgIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsXG4gICAgICAgICAgfX1cbiAgICAgICAgPlxuICAgICAgICAgIDxzdmdcbiAgICAgICAgICAgIHN0eWxlPXt7IHdpZHRoOiBcIjNyZW1cIiwgaGVpZ2h0OiBcIjNyZW1cIiwgY29sb3I6IFwiIzNiODJmNlwiLCBtYXJnaW5Cb3R0b206IFwiMC43NXJlbVwiIH19XG4gICAgICAgICAgICBmaWxsPSdub25lJ1xuICAgICAgICAgICAgc3Ryb2tlPSdjdXJyZW50Q29sb3InXG4gICAgICAgICAgICB2aWV3Qm94PScwIDAgMjQgMjQnXG4gICAgICAgICAgPlxuICAgICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgICAgc3Ryb2tlTGluZWNhcD0ncm91bmQnXG4gICAgICAgICAgICAgIHN0cm9rZUxpbmVqb2luPSdyb3VuZCdcbiAgICAgICAgICAgICAgc3Ryb2tlV2lkdGg9JzInXG4gICAgICAgICAgICAgIGQ9J005IDEyaDZtLTYgNGg2bTIgNUg3YTIgMiAwIDAxLTItMlY1YTIgMiAwIDAxMi0yaDUuNTg2YTEgMSAwIDAxLjcwNy4yOTNsNS40MTQgNS40MTRhMSAxIDAgMDEuMjkzLjcwN1YxOWEyIDIgMCAwMS0yIDJ6J1xuICAgICAgICAgICAgPjwvcGF0aD5cbiAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICA8cCBzdHlsZT17eyBjb2xvcjogXCIjMzc0MTUxXCIsIGZvbnRXZWlnaHQ6IFwiNTAwXCIsIG1hcmdpbjogXCIwIDAgMC4yNXJlbSAwXCIgfX0+TG9jYWwgRG9jdW1lbnQgRmlsZTwvcD5cbiAgICAgICAgICA8cCBzdHlsZT17eyBmb250U2l6ZTogXCIwLjg3NXJlbVwiLCBjb2xvcjogXCIjNmI3MjgwXCIsIG1hcmdpbjogXCIwIDAgMXJlbSAwXCIgfX0+XG4gICAgICAgICAgICBCcm93c2VycyBjYW5ub3QgcHJldmlldyB7bWltZUNsYXNzfSBmaWxlcyBkaXJlY3RseS5cbiAgICAgICAgICA8L3A+XG4gICAgICAgICAgPGFcbiAgICAgICAgICAgIGhyZWY9e2ZpbGVVcmx9XG4gICAgICAgICAgICBkb3dubG9hZD17c2FuaXRpemVkRmlsZU5hbWV9IC8vIFByb21wdHMgYnJvd3NlciB0byBcInNhdmUgYXNcIiBzbyB1c2VyIGNhbiBvcGVuIG5hdGl2ZWx5XG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiI2RiZWFmZVwiLFxuICAgICAgICAgICAgICBjb2xvcjogXCIjMWQ0ZWQ4XCIsXG4gICAgICAgICAgICAgIHBhZGRpbmc6IFwiMC41cmVtIDFyZW1cIixcbiAgICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiBcIjAuMjVyZW1cIixcbiAgICAgICAgICAgICAgZm9udFdlaWdodDogXCI1MDBcIixcbiAgICAgICAgICAgICAgdGV4dERlY29yYXRpb246IFwibm9uZVwiLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICBFeHRyYWN0IHRvIHZpZXdcbiAgICAgICAgICA8L2E+XG4gICAgICAgIDwvZGl2PlxuICAgICAgKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIGNvbnRlbnQgPSAoXG4gICAgICAgIDxkaXZcbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgcGFkZGluZzogXCIxcmVtXCIsXG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiI2YzZjRmNlwiLFxuICAgICAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCAjZTVlN2ViXCIsXG4gICAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiMC4yNXJlbVwiLFxuICAgICAgICAgICAgdGV4dEFsaWduOiBcImNlbnRlclwiLFxuICAgICAgICAgIH19XG4gICAgICAgID5cbiAgICAgICAgICA8cCBzdHlsZT17eyBjb2xvcjogXCIjNGI1NTYzXCIsIG1hcmdpbjogMCB9fT5QcmV2aWV3IG5vdCBhdmFpbGFibGUgZm9yIHRoaXMgZmlsZSB0eXBlLjwvcD5cbiAgICAgICAgPC9kaXY+XG4gICAgICApO1xuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICBzdHlsZT17e1xuICAgICAgICBtYXJnaW5Cb3R0b206IFwiMS41cmVtXCIsXG4gICAgICAgIGJhY2tncm91bmRDb2xvcjogXCIjZmZmXCIsXG4gICAgICAgIHBhZGRpbmc6IFwiMXJlbVwiLFxuICAgICAgICBib3JkZXJSYWRpdXM6IFwiMC41cmVtXCIsXG4gICAgICAgIGJveFNoYWRvdzogXCIwIDFweCAzcHggcmdiYSgwLDAsMCwwLjEpXCIsXG4gICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgI2U1ZTdlYlwiLFxuICAgICAgfX1cbiAgICA+XG4gICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6IFwiZmxleFwiLCBqdXN0aWZ5Q29udGVudDogXCJzcGFjZS1iZXR3ZWVuXCIsIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsIG1hcmdpbkJvdHRvbTogXCIwLjc1cmVtXCIgfX0+XG4gICAgICAgIDxoNFxuICAgICAgICAgIHRpdGxlPXtyYXdGaWxlTmFtZX1cbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgZm9udFdlaWdodDogXCI2MDBcIixcbiAgICAgICAgICAgIGNvbG9yOiBcIiMxZjI5MzdcIixcbiAgICAgICAgICAgIG1hcmdpbjogMCxcbiAgICAgICAgICAgIHdoaXRlU3BhY2U6IFwibm93cmFwXCIsXG4gICAgICAgICAgICBvdmVyZmxvdzogXCJoaWRkZW5cIixcbiAgICAgICAgICAgIHRleHRPdmVyZmxvdzogXCJlbGxpcHNpc1wiLFxuICAgICAgICAgICAgbWF4V2lkdGg6IFwiNjAlXCIsXG4gICAgICAgICAgfX1cbiAgICAgICAgPlxuICAgICAgICAgIHtyYXdGaWxlTmFtZX1cbiAgICAgICAgPC9oND5cblxuICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6IFwiZmxleFwiLCBnYXA6IFwiMC43NXJlbVwiLCBhbGlnbkl0ZW1zOiBcImNlbnRlclwiIH19PlxuICAgICAgICAgIDxzcGFuIHN0eWxlPXt7IGZvbnRTaXplOiBcIjAuNzVyZW1cIiwgY29sb3I6IFwiIzZiNzI4MFwiIH19Pntmb3JtYXR0ZWRTaXplfTwvc3Bhbj5cbiAgICAgICAgICA8YVxuICAgICAgICAgICAgaHJlZj17ZmlsZVVybH1cbiAgICAgICAgICAgIGRvd25sb2FkPXtzYW5pdGl6ZWRGaWxlTmFtZX1cbiAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogXCIjMjU2M2ViXCIsXG4gICAgICAgICAgICAgIGNvbG9yOiBcIiNmZmZcIixcbiAgICAgICAgICAgICAgZm9udFNpemU6IFwiMC44NzVyZW1cIixcbiAgICAgICAgICAgICAgcGFkZGluZzogXCIwLjI1cmVtIDAuNzVyZW1cIixcbiAgICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiBcIjAuMjVyZW1cIixcbiAgICAgICAgICAgICAgdGV4dERlY29yYXRpb246IFwibm9uZVwiLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICBFeHRyYWN0XG4gICAgICAgICAgPC9hPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdlxuICAgICAgICBzdHlsZT17e1xuICAgICAgICAgIHdpZHRoOiBcIjEwMCVcIixcbiAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICBqdXN0aWZ5Q29udGVudDogXCJjZW50ZXJcIixcbiAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiI2Y5ZmFmYlwiLFxuICAgICAgICAgIGJvcmRlclJhZGl1czogXCIwLjI1cmVtXCIsXG4gICAgICAgICAgcGFkZGluZzogXCIwLjVyZW1cIixcbiAgICAgICAgICBib3hTaXppbmc6IFwiYm9yZGVyLWJveFwiLFxuICAgICAgICB9fVxuICAgICAgPlxuICAgICAgICB7Y29udGVudH1cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufSIsIi8qKlxuICogVGhpcyBmdW5jdGlvbiByZW5kZXJzIGEgUFBUWCBmaWxlIHRvIGFuIEhUTUwgcGFnZSB1c2luZyB0aGUgcHB0eHZpZXdqcyBsaWJyYXJ5LlxuICogQHBhcmFtIHsqfSBmaWxlT2JqZWN0IC0gVGhlIGZpbGUgb2JqZWN0IHRvIHJlbmRlci5cbiAqIEBwYXJhbSB7Kn0gZmlsZU5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZmlsZSB0byByZW5kZXIuXG4gKiBAcmV0dXJucyBUaGUgcHB0eCB2aWV3ZXIgY29tcG9uZW50IGZvciB0aGUgYXNzaWdubWVudC5cbiAqL1xuZnVuY3Rpb24gUHB0eE1lbW9yeVZpZXdlcih7IGZpbGVPYmplY3QsIGZpbGVOYW1lID0gXCJwcmVzZW50YXRpb24ucHB0eFwiIH0pIHtcbiAgY29uc3QgY2FudmFzUmVmID0gUmVhY3QudXNlUmVmKG51bGwpO1xuICBjb25zdCB2aWV3ZXJSZWYgPSBSZWFjdC51c2VSZWYobnVsbCk7XG5cbiAgY29uc3QgW2xvYWRpbmcsIHNldExvYWRpbmddID0gdXNlU3RhdGUodHJ1ZSk7XG4gIGNvbnN0IFtyZW5kZXJGYWlsZWQsIHNldFJlbmRlckZhaWxlZF0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFtmYWxsYmFja1VybCwgc2V0RmFsbGJhY2tVcmxdID0gdXNlU3RhdGUobnVsbCk7XG5cbiAgLy8gR2VuZXJhdGUgZmFsbGJhY2sgVVJMIGZvciBleHRyYWN0aW9uIGlmIHJlbmRlciBmYWlsc1xuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghZmlsZU9iamVjdCkgcmV0dXJuO1xuICAgIGNvbnN0IHVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoZmlsZU9iamVjdCk7XG4gICAgc2V0RmFsbGJhY2tVcmwodXJsKTtcbiAgICByZXR1cm4gKCkgPT4gVVJMLnJldm9rZU9iamVjdFVSTCh1cmwpO1xuICB9LCBbZmlsZU9iamVjdF0pO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgbGV0IGlzTW91bnRlZCA9IHRydWU7XG5cbiAgICBhc3luYyBmdW5jdGlvbiByZW5kZXJTbGlkZXMoKSB7XG4gICAgICBpZiAoIWZpbGVPYmplY3QgfHwgIWNhbnZhc1JlZi5jdXJyZW50KSByZXR1cm47XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIHNldExvYWRpbmcodHJ1ZSk7XG5cbiAgICAgICAgY29uc3QgVmlld2VyQ2xhc3MgPVxuICAgICAgICAgIHdpbmRvdy5QUFRYVmlld2VyIHx8XG4gICAgICAgICAgKHdpbmRvdy5QcHR4Vmlld0pTICYmIHdpbmRvdy5QcHR4Vmlld0pTLlBQVFhWaWV3ZXIpIHx8XG4gICAgICAgICAgKHdpbmRvdy5wcHR4dmlld2pzICYmIHdpbmRvdy5wcHR4dmlld2pzLlBQVFhWaWV3ZXIpIHx8XG4gICAgICAgICAgd2luZG93LlBwdHhWaWV3SlM7XG5cbiAgICAgICAgaWYgKCFWaWV3ZXJDbGFzcykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlBwdHhWaWV3SlMgc2NyaXB0IHRhZyBub3QgbG9hZGVkIG9yIGdsb2JhbCB1bmF2YWlsYWJsZS5cIik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB2aWV3ZXIgPSBuZXcgVmlld2VyQ2xhc3MoeyBjYW52YXM6IGNhbnZhc1JlZi5jdXJyZW50IH0pO1xuICAgICAgICB2aWV3ZXJSZWYuY3VycmVudCA9IHZpZXdlcjtcblxuICAgICAgICBjb25zdCBhcnJheUJ1ZmZlciA9IGF3YWl0IGZpbGVPYmplY3QuYXJyYXlCdWZmZXIoKTtcblxuICAgICAgICBhd2FpdCB2aWV3ZXIubG9hZEZpbGUoYXJyYXlCdWZmZXIpO1xuICAgICAgICBhd2FpdCB2aWV3ZXIucmVuZGVyKCk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS53YXJuKFwiUHB0eFZpZXdKUyByZW5kZXIgZmFpbGVkLCBzd2l0Y2hpbmcgdG8gZXh0cmFjdGlvbiBmYWxsYmFjazpcIiwgZXJyKTtcbiAgICAgICAgaWYgKGlzTW91bnRlZCkge1xuICAgICAgICAgIHNldFJlbmRlckZhaWxlZCh0cnVlKTtcbiAgICAgICAgfVxuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgaWYgKGlzTW91bnRlZCkge1xuICAgICAgICAgIHNldExvYWRpbmcoZmFsc2UpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmVuZGVyU2xpZGVzKCk7XG5cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgaXNNb3VudGVkID0gZmFsc2U7XG4gICAgfTtcbiAgfSwgW2ZpbGVPYmplY3RdKTtcblxuICBjb25zdCBoYW5kbGVOZXh0U2xpZGUgPSBhc3luYyAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGlmICh2aWV3ZXJSZWYuY3VycmVudD8ubmV4dFNsaWRlKSB7XG4gICAgICAgIGF3YWl0IHZpZXdlclJlZi5jdXJyZW50Lm5leHRTbGlkZSgpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiRW5kIG9mIHByZXNlbnRhdGlvbiByZWFjaGVkLlwiKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlUHJldlNsaWRlID0gYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBpZiAodmlld2VyUmVmLmN1cnJlbnQ/LnByZXZpb3VzU2xpZGUpIHtcbiAgICAgICAgYXdhaXQgdmlld2VyUmVmLmN1cnJlbnQucHJldmlvdXNTbGlkZSgpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiQmVnaW5uaW5nIG9mIHByZXNlbnRhdGlvbiByZWFjaGVkLlwiKTtcbiAgICB9XG4gIH07XG5cbiAgaWYgKHJlbmRlckZhaWxlZCkge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2XG4gICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgcGFkZGluZzogXCIycmVtXCIsXG4gICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcIiNmOWZhZmJcIixcbiAgICAgICAgICBib3JkZXI6IFwiMXB4IHNvbGlkICNlNWU3ZWJcIixcbiAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiMC4yNXJlbVwiLFxuICAgICAgICAgIHRleHRBbGlnbjogXCJjZW50ZXJcIixcbiAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICBmbGV4RGlyZWN0aW9uOiBcImNvbHVtblwiLFxuICAgICAgICAgIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsXG4gICAgICAgIH19XG4gICAgICA+XG4gICAgICAgIDxzdmdcbiAgICAgICAgICBzdHlsZT17eyB3aWR0aDogXCIzcmVtXCIsIGhlaWdodDogXCIzcmVtXCIsIGNvbG9yOiBcIiNmOTczMTZcIiwgbWFyZ2luQm90dG9tOiBcIjAuNzVyZW1cIiB9fVxuICAgICAgICAgIGZpbGw9J25vbmUnXG4gICAgICAgICAgc3Ryb2tlPSdjdXJyZW50Q29sb3InXG4gICAgICAgICAgdmlld0JveD0nMCAwIDI0IDI0J1xuICAgICAgICA+XG4gICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgIHN0cm9rZUxpbmVjYXA9J3JvdW5kJ1xuICAgICAgICAgICAgc3Ryb2tlTGluZWpvaW49J3JvdW5kJ1xuICAgICAgICAgICAgc3Ryb2tlV2lkdGg9JzInXG4gICAgICAgICAgICBkPSdNMTIgOXYybTAgNGguMDFtLTYuOTM4IDRoMTMuODU2YzEuNTQgMCAyLjUwMi0xLjY2NyAxLjczMi0zTDEzLjczMiA0Yy0uNzctMS4zMzMtMi42OTQtMS4zMzMtMy40NjQgMEwzLjM0IDE2Yy0uNzcgMS4zMzMuMTkyIDMgMS43MzIgM3onXG4gICAgICAgICAgPjwvcGF0aD5cbiAgICAgICAgPC9zdmc+XG4gICAgICAgIDxwIHN0eWxlPXt7IGNvbG9yOiBcIiMzNzQxNTFcIiwgZm9udFdlaWdodDogXCI1MDBcIiwgbWFyZ2luOiBcIjAgMCAwLjI1cmVtIDBcIiB9fT5Db21wbGV4IFBvd2VyUG9pbnQgRmlsZTwvcD5cbiAgICAgICAgPHAgc3R5bGU9e3sgZm9udFNpemU6IFwiMC44NzVyZW1cIiwgY29sb3I6IFwiIzZiNzI4MFwiLCBtYXJnaW46IFwiMCAwIDFyZW0gMFwiIH19PlVuYWJsZSB0byBwcmV2aWV3IHNsaWRlcyBpbmxpbmUuPC9wPlxuICAgICAgICB7ZmFsbGJhY2tVcmwgJiYgKFxuICAgICAgICAgIDxhXG4gICAgICAgICAgICBocmVmPXtmYWxsYmFja1VybH1cbiAgICAgICAgICAgIGRvd25sb2FkPXtmaWxlTmFtZX1cbiAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogXCIjZGJlYWZlXCIsXG4gICAgICAgICAgICAgIGNvbG9yOiBcIiMxZDRlZDhcIixcbiAgICAgICAgICAgICAgcGFkZGluZzogXCIwLjVyZW0gMXJlbVwiLFxuICAgICAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiMC4yNXJlbVwiLFxuICAgICAgICAgICAgICBmb250V2VpZ2h0OiBcIjUwMFwiLFxuICAgICAgICAgICAgICB0ZXh0RGVjb3JhdGlvbjogXCJub25lXCIsXG4gICAgICAgICAgICB9fVxuICAgICAgICAgID5cbiAgICAgICAgICAgIEV4dHJhY3QgdG8gdmlldyBpbiBQb3dlclBvaW50XG4gICAgICAgICAgPC9hPlxuICAgICAgICApfVxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiAoXG4gICAgPGRpdlxuICAgICAgc3R5bGU9e3tcbiAgICAgICAgd2lkdGg6IFwiMTAwJVwiLFxuICAgICAgICBtaW5IZWlnaHQ6IFwiNDUwcHhcIixcbiAgICAgICAgcGFkZGluZzogXCIxLjVyZW1cIixcbiAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcIiMyYTJkMzJcIixcbiAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCAjZTVlN2ViXCIsXG4gICAgICAgIGJvcmRlclJhZGl1czogXCIwLjM3NXJlbVwiLFxuICAgICAgICBib3hTaXppbmc6IFwiYm9yZGVyLWJveFwiLFxuICAgICAgICBwb3NpdGlvbjogXCJyZWxhdGl2ZVwiLFxuICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIixcbiAgICAgICAgYWxpZ25JdGVtczogXCJjZW50ZXJcIixcbiAgICAgICAganVzdGlmeUNvbnRlbnQ6IFwiY2VudGVyXCIsXG4gICAgICB9fVxuICAgID5cbiAgICAgIHtsb2FkaW5nICYmIChcbiAgICAgICAgPGRpdlxuICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICBwb3NpdGlvbjogXCJhYnNvbHV0ZVwiLFxuICAgICAgICAgICAgdG9wOiAwLFxuICAgICAgICAgICAgbGVmdDogMCxcbiAgICAgICAgICAgIHJpZ2h0OiAwLFxuICAgICAgICAgICAgYm90dG9tOiAwLFxuICAgICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsXG4gICAgICAgICAgICBhbGlnbkl0ZW1zOiBcImNlbnRlclwiLFxuICAgICAgICAgICAganVzdGlmeUNvbnRlbnQ6IFwiY2VudGVyXCIsXG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiIzJhMmQzMlwiLFxuICAgICAgICAgICAgY29sb3I6IFwiI2ZmZlwiLFxuICAgICAgICAgICAgekluZGV4OiAxMCxcbiAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCIwLjM3NXJlbVwiLFxuICAgICAgICAgIH19XG4gICAgICAgID5cbiAgICAgICAgICBMb2FkaW5nIFByZXNlbnRhdGlvbi4uLlxuICAgICAgICA8L2Rpdj5cbiAgICAgICl9XG5cbiAgICAgIHsvKiBcbiAgICAgICAgVGhpcyBzdHlsZSBibG9jayBmb3JjZXMgdGhlIGJyb3dzZXIgdG8gaWdub3JlIHRoZSBsaWJyYXJ5J3MgaW5saW5lIHBpeGVsIFxuICAgICAgICB3aWR0aHMgYW5kIHN0cmV0Y2ggdGhlIGNhbnZhcyB0byBmaWxsIHRoZSBtYXgtd2lkdGggY29udGFpbmVyIGJlbG93LlxuICAgICAgKi99XG4gICAgICA8c3R5bGU+XG4gICAgICAgIHtgXG4gICAgICAgICAgLmZvcmNlZC1mdWxsLXdpZHRoIHtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBoZWlnaHQ6IGF1dG8gIWltcG9ydGFudDtcbiAgICAgICAgICB9XG4gICAgICAgIGB9XG4gICAgICA8L3N0eWxlPlxuXG4gICAgICA8ZGl2XG4gICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgd2lkdGg6IFwiMTAwJVwiLFxuICAgICAgICAgIG1heFdpZHRoOiBcIjk2MHB4XCIsIC8vIFRoZSBzbGlkZXMgd2lsbCBzYWZlbHkgc2NhbGUgdXAgdG8gdGhpcyB3aWR0aFxuICAgICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICAgIGp1c3RpZnlDb250ZW50OiBcImNlbnRlclwiLFxuICAgICAgICAgIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsXG4gICAgICAgICAgb3BhY2l0eTogbG9hZGluZyA/IDAgOiAxLFxuICAgICAgICAgIHRyYW5zaXRpb246IFwib3BhY2l0eSAwLjNzIGVhc2VcIixcbiAgICAgICAgfX1cbiAgICAgID5cbiAgICAgICAgPGNhbnZhc1xuICAgICAgICAgIHJlZj17Y2FudmFzUmVmfVxuICAgICAgICAgIGNsYXNzTmFtZT0nZm9yY2VkLWZ1bGwtd2lkdGgnXG4gICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgIGRpc3BsYXk6IFwiYmxvY2tcIixcbiAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogXCIjZmZmXCIsXG4gICAgICAgICAgICBib3hTaGFkb3c6IFwiMCAxMHB4IDI1cHggLTVweCByZ2JhKDAsIDAsIDAsIDAuNiksIDAgOHB4IDEwcHggLTZweCByZ2JhKDAsIDAsIDAsIDAuNClcIixcbiAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCI0cHhcIixcbiAgICAgICAgICB9fVxuICAgICAgICAvPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxkaXZcbiAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICBqdXN0aWZ5Q29udGVudDogXCJjZW50ZXJcIixcbiAgICAgICAgICBnYXA6IFwiMXJlbVwiLFxuICAgICAgICAgIG1hcmdpblRvcDogXCIxLjI1cmVtXCIsXG4gICAgICAgICAgb3BhY2l0eTogbG9hZGluZyA/IDAgOiAxLFxuICAgICAgICAgIHBvaW50ZXJFdmVudHM6IGxvYWRpbmcgPyBcIm5vbmVcIiA6IFwiYXV0b1wiLFxuICAgICAgICB9fVxuICAgICAgPlxuICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgb25DbGljaz17aGFuZGxlUHJldlNsaWRlfVxuICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICBwYWRkaW5nOiBcIjAuNXJlbSAxLjI1cmVtXCIsXG4gICAgICAgICAgICBjdXJzb3I6IFwicG9pbnRlclwiLFxuICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiBcIjRweFwiLFxuICAgICAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCAjNGI1NTYzXCIsXG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiIzM3NDE1MVwiLFxuICAgICAgICAgICAgY29sb3I6IFwid2hpdGVcIixcbiAgICAgICAgICAgIGZvbnRXZWlnaHQ6IFwiNTAwXCIsXG4gICAgICAgICAgfX1cbiAgICAgICAgPlxuICAgICAgICAgICZsYXJyOyBQcmV2aW91cyBTbGlkZVxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvblxuICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZU5leHRTbGlkZX1cbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgcGFkZGluZzogXCIwLjVyZW0gMS4yNXJlbVwiLFxuICAgICAgICAgICAgY3Vyc29yOiBcInBvaW50ZXJcIixcbiAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCI0cHhcIixcbiAgICAgICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgIzRiNTU2M1wiLFxuICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcIiMzNzQxNTFcIixcbiAgICAgICAgICAgIGNvbG9yOiBcIndoaXRlXCIsXG4gICAgICAgICAgICBmb250V2VpZ2h0OiBcIjUwMFwiLFxuICAgICAgICAgIH19XG4gICAgICAgID5cbiAgICAgICAgICBOZXh0IFNsaWRlICZyYXJyO1xuICAgICAgICA8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufVxuIiwiLyoqXG4gKiBNb2RpZmllZCBDYW52YXNMTVMgc291cmNlIGNvZGUgdG8gY3JlYXRlIGEgc2ltaWxhciBsb29raW5nIHNjb3JlIGRpc3RyaWJ1dGlvbiBncmFwaCAoYm94cGxvdClcbiAqIEBwYXJhbSB7T2JqZWN0fSBhc3NpZ25tZW50IC0gVGhlIGFzc2lnbm1lbnQgdG8gY3JlYXRlIGEgc2NvcmUgZGlzdHJpYnV0aW9uIGdyYXBoIGZvci4gTXVzdCBjb250YWluIHNjb3JlX3N0YXRpc3RpY3MuXG4gKiBAcmV0dXJucyB7SlNYLkVsZW1lbnR9IFRoZSBzY29yZSBkaXN0cmlidXRpb24gZ3JhcGguXG4gKi9cbmNvbnN0IFNjb3JlRGlzdHJpYnV0aW9uR3JhcGggPSAoeyBhc3NpZ25tZW50IH0pID0+IHtcbiAgLy8gQ29uc3RhbnRzIGJhc2VkIG9uIENhbnZhcyBMTVMgU1ZHIGNvb3JkaW5hdGUgc3lzdGVtXG4gIGNvbnN0IEdSQVBIX1NDQUxBUiA9IDE1MC4wO1xuICBjb25zdCBHUkFZX0NPTE9SID0gXCIjNEE1QjY4XCI7XG4gIGNvbnN0IEJMVUVfQ09MT1IgPSBcIiMyMjQ0ODhcIjtcbiAgY29uc3QgQkxVRV9GSUxMX0NPTE9SID0gXCIjYWFiYmRkXCI7XG5cbiAgLy8gU2FmZXR5IGZhbGxiYWNrcyBmb3Igc2NvcmUgc2NhbGluZ1xuICBjb25zdCBwb2ludHNQb3NzaWJsZSA9IGFzc2lnbm1lbnQ/LnBvaW50c19wb3NzaWJsZSB8fCAxMDtcblxuICBjb25zdCBzY2FsZVN0YXRWYWx1ZSA9IChzdGF0KSA9PiB7XG4gICAgaWYgKHN0YXQgPT09IHVuZGVmaW5lZCB8fCBzdGF0ID09PSBudWxsIHx8IGlzTmFOKHN0YXQpKSByZXR1cm4gMDtcbiAgICByZXR1cm4gKE51bWJlcihzdGF0KSAvIHBvaW50c1Bvc3NpYmxlKSAqIEdSQVBIX1NDQUxBUjtcbiAgfTtcblxuICAvLyBFeHRyYWN0IHZhbHVlcyBkaXJlY3RseSBmcm9tIHlvdXIgSlNPTiBmb3JtYXRcbiAgY29uc3QgdXNlclNjb3JlID0gYXNzaWdubWVudD8uc3VibWlzc2lvbj8uc2NvcmU7XG4gIGNvbnN0IHN0YXRzID0gYXNzaWdubWVudD8uc2NvcmVfc3RhdGlzdGljcyB8fCB7fTtcblxuICBjb25zdCBncmFwaCA9IHtcbiAgICB0aXRsZTogYFNjb3JlIERpc3RyaWJ1dGlvbiBHcmFwaCAtICR7YXNzaWdubWVudD8ubmFtZSB8fCBcIlwifWAsXG4gICAgbWF4X3BvczogR1JBUEhfU0NBTEFSLFxuICAgIGxvd19wb3M6IHNjYWxlU3RhdFZhbHVlKHN0YXRzLm1pbiksXG4gICAgbHFfcG9zOiBzY2FsZVN0YXRWYWx1ZShzdGF0cy5sb3dlcl9xKSxcbiAgICB1cV9wb3M6IHNjYWxlU3RhdFZhbHVlKHN0YXRzLnVwcGVyX3EpLFxuICAgIGhpZ2hfcG9zOiBzY2FsZVN0YXRWYWx1ZShzdGF0cy5tYXgpLFxuICAgIG1lZGlhbl9wb3M6IHNjYWxlU3RhdFZhbHVlKHN0YXRzLm1lZGlhbiksXG4gICAgc2NvcmVfcG9zOiBzY2FsZVN0YXRWYWx1ZSh1c2VyU2NvcmUpLFxuICB9O1xuXG4gIC8vIFNWRyBHZW9tZXRyeSBEaW1lbnNpb25zXG4gIGNvbnN0IHplcm9Qb3NpdGlvbiA9IFwiMFwiO1xuICBjb25zdCBtYXhTdmdIZWlnaHQgPSBcIjI3XCI7XG4gIGNvbnN0IG1pblN2Z0hlaWdodCA9IFwiM1wiO1xuICBjb25zdCBkaXNwbGF5U3ZnSGVpZ2h0ID0gXCIyNFwiO1xuICBjb25zdCBzdGFydFN2Z0hlaWdodCA9IFwiNlwiO1xuICBjb25zdCBzdHJva2VXaWR0aERlZmF1bHQgPSBcIjJcIjtcbiAgY29uc3QgbWlkU3ZnSGVpZ2h0ID0gXCIxNVwiO1xuXG4gIGNvbnN0IG15U2NvcmVCb3hIZWlnaHQgPSBcIjE0XCI7XG4gIGNvbnN0IG15U2NvcmVCb3hTdGFydFBvcyA9IFwiOFwiO1xuXG4gIGNvbnN0IHZpZXdCb3hWYWx1ZXMgPSBcIi0xIDAgMTYwIDMwXCI7XG5cbiAgY29uc3QgY3JlYXRlU3ZnTGluZSA9IChjbGFzc05hbWUsIHgxLCB5MSwgeDIsIHkyLCBzdHJva2VXaWR0aCA9IHN0cm9rZVdpZHRoRGVmYXVsdCkgPT4gKHtcbiAgICBjbGFzc05hbWUsXG4gICAgeDEsXG4gICAgeTEsXG4gICAgeDIsXG4gICAgeTIsXG4gICAgc3Ryb2tlV2lkdGgsXG4gIH0pO1xuXG4gIGNvbnN0IHN2Z0xpbmVzID0gW1xuICAgIGNyZWF0ZVN2Z0xpbmUoXCJ6ZXJvXCIsIHplcm9Qb3NpdGlvbiwgbWluU3ZnSGVpZ2h0LCB6ZXJvUG9zaXRpb24sIG1heFN2Z0hlaWdodCksXG4gICAgY3JlYXRlU3ZnTGluZShcInBvc3NpYmxlXCIsIGAke2dyYXBoLm1heF9wb3N9YCwgbWluU3ZnSGVpZ2h0LCBgJHtncmFwaC5tYXhfcG9zfWAsIG1heFN2Z0hlaWdodCksXG4gICAgY3JlYXRlU3ZnTGluZShcIm1pblwiLCBgJHtncmFwaC5sb3dfcG9zfWAsIHN0YXJ0U3ZnSGVpZ2h0LCBgJHtncmFwaC5sb3dfcG9zfWAsIGRpc3BsYXlTdmdIZWlnaHQpLFxuICAgIGNyZWF0ZVN2Z0xpbmUoXCJib3R0b21RXCIsIGAke2dyYXBoLmxvd19wb3N9YCwgbWlkU3ZnSGVpZ2h0LCBgJHtncmFwaC5scV9wb3N9YCwgbWlkU3ZnSGVpZ2h0KSxcbiAgICBjcmVhdGVTdmdMaW5lKFwidG9wUVwiLCBgJHtncmFwaC51cV9wb3N9YCwgbWlkU3ZnSGVpZ2h0LCBgJHtncmFwaC5oaWdoX3Bvc31gLCBtaWRTdmdIZWlnaHQpLFxuICAgIGNyZWF0ZVN2Z0xpbmUoXCJtYXhcIiwgYCR7Z3JhcGguaGlnaF9wb3N9YCwgc3RhcnRTdmdIZWlnaHQsIGAke2dyYXBoLmhpZ2hfcG9zfWAsIGRpc3BsYXlTdmdIZWlnaHQpLFxuICAgIGNyZWF0ZVN2Z0xpbmUoXCJtZWRpYW5cIiwgYCR7Z3JhcGgubWVkaWFuX3Bvc31gLCBtaW5TdmdIZWlnaHQsIGAke2dyYXBoLm1lZGlhbl9wb3N9YCwgbWF4U3ZnSGVpZ2h0KSxcbiAgXTtcblxuICBjb25zdCBtaWQ1MFJlY3QgPSB7XG4gICAgY2xhc3NOYW1lOiBcIm1pZDUwXCIsXG4gICAgeDogYCR7Z3JhcGgubHFfcG9zfWAsXG4gICAgeTogbWluU3ZnSGVpZ2h0LFxuICAgIHdpZHRoOiBgJHtNYXRoLm1heCgwLCBncmFwaC51cV9wb3MgLSBncmFwaC5scV9wb3MpfWAsXG4gICAgaGVpZ2h0OiBkaXNwbGF5U3ZnSGVpZ2h0LFxuICAgIHN0cm9rZVdpZHRoOiBzdHJva2VXaWR0aERlZmF1bHQsXG4gICAgcng6IG1pblN2Z0hlaWdodCxcbiAgICBmaWxsOiBcIm5vbmVcIixcbiAgfTtcblxuICBjb25zdCBteVNjb3JlUmVjdCA9IHtcbiAgICB4OiBgJHtncmFwaC5zY29yZV9wb3MgLSA3fWAsXG4gICAgeTogbXlTY29yZUJveFN0YXJ0UG9zLFxuICAgIHdpZHRoOiBteVNjb3JlQm94SGVpZ2h0LFxuICAgIGhlaWdodDogbXlTY29yZUJveEhlaWdodCxcbiAgICBzdHJva2VXaWR0aDogc3Ryb2tlV2lkdGhEZWZhdWx0LFxuICAgIHJ4OiBtaW5TdmdIZWlnaHQsXG4gICAgZmlsbDogQkxVRV9GSUxMX0NPTE9SLFxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPHN2Z1xuICAgICAgdmlld0JveD17dmlld0JveFZhbHVlc31cbiAgICAgIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZydcbiAgICAgIHN0eWxlPXt7XG4gICAgICAgIGN1cnNvcjogXCJwb2ludGVyXCIsXG4gICAgICAgIGZsb2F0OiBcInJpZ2h0XCIsXG4gICAgICAgIGhlaWdodDogXCIzMHB4XCIsXG4gICAgICAgIHdpZHRoOiBcIjE2MXB4XCIsXG4gICAgICAgIHBvc2l0aW9uOiBcInJlbGF0aXZlXCIsXG4gICAgICB9fVxuICAgICAgYXJpYS1oaWRkZW49J3RydWUnXG4gICAgICBkYXRhLXRlc3RpZD0nc2NvcmVEaXN0cmlidXRpb25HcmFwaCdcbiAgICA+XG4gICAgICA8dGl0bGU+e2dyYXBoLnRpdGxlfTwvdGl0bGU+XG5cbiAgICAgIHsvKiBCb3hwbG90IFdoaXNrZXJzICYgQm91bmRhcnkgTGluZXMgKi99XG4gICAgICB7c3ZnTGluZXMubWFwKChsaW5lSW5zdHJ1Y3Rpb25zKSA9PiAoXG4gICAgICAgIDxsaW5lIGtleT17bGluZUluc3RydWN0aW9ucy5jbGFzc05hbWV9IHsuLi5saW5lSW5zdHJ1Y3Rpb25zfSBzdHJva2U9e0dSQVlfQ09MT1J9IC8+XG4gICAgICApKX1cblxuICAgICAgey8qIE1pZGRsZSA1MCUgQm94IChJUVIpICovfVxuICAgICAgPHJlY3Qgey4uLm1pZDUwUmVjdH0gc3Ryb2tlPXtHUkFZX0NPTE9SfSAvPlxuXG4gICAgICB7LyogU3R1ZGVudCBTY29yZSBTcXVhcmUgTWFya2VyICovfVxuICAgICAge3VzZXJTY29yZSAhPT0gdW5kZWZpbmVkICYmIHVzZXJTY29yZSAhPT0gbnVsbCAmJiAoXG4gICAgICAgIDxyZWN0IGNsYXNzTmFtZT0nbXlTY29yZScgey4uLm15U2NvcmVSZWN0fSBzdHJva2U9e0JMVUVfQ09MT1J9PlxuICAgICAgICAgIDx0aXRsZT57YFlvdXIgU2NvcmU6ICR7dXNlclNjb3JlfSBvdXQgb2YgJHtwb2ludHNQb3NzaWJsZX1gfTwvdGl0bGU+XG4gICAgICAgIDwvcmVjdD5cbiAgICAgICl9XG4gICAgPC9zdmc+XG4gICk7XG59O1xuIiwiLyoqXG4gKiBUb3AgQnJlYWRjcnVtYnMgY29tcG9uZW50IHRoYXQgZGlzcGxheXMgbmF2aWdhdGlvbiBicmVhZGNydW1icyBmb3IgdGhlIGNvdXJzZS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wc1xuICogQHBhcmFtIHt7dGl0bGU6IHN0cmluZywgY2FsbGJhY2s/OiBmdW5jdGlvbn1bXX0gcHJvcHMubGlzdFxuICovXG5mdW5jdGlvbiBUb3BCcmVhZGNydW1icyh7IGxpc3QgPSBbXSB9KSB7XG4gIGNvbnN0IHsgY291cnNlRGF0YSB9ID0gdXNlQ291cnNlQ29udGV4dCgpO1xuICBjb25zdCB7IG5hdmlnYXRlVG9TZWN0aW9uIH0gPSB1c2VOYXZpZ2F0aW9uKCk7XG5cbiAgaWYgKCFjb3Vyc2VEYXRhKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBjb3Vyc2VUaXRsZSA9IGNvdXJzZURhdGE/Lm1hbmlmZXN0Py5jb3Vyc2U7XG5cbiAgcmV0dXJuIChcbiAgICA8bmF2IGFyaWEtbGFiZWw9J2JyZWFkY3J1bWInPlxuICAgICAgPG9sIGNsYXNzTmFtZT0ndG9wLWJyZWFkY3J1bWJzJz5cbiAgICAgICAge2NvdXJzZVRpdGxlICYmIChcbiAgICAgICAgICA8bGkgY2xhc3NOYW1lPSdicmVhZGNydW1iLWl0ZW0nIHN0eWxlPXt7IGN1cnNvcjogXCJwb2ludGVyXCIgfX0gb25DbGljaz17KCkgPT4gbmF2aWdhdGVUb1NlY3Rpb24oXCJmcm9udHBhZ2VcIil9PlxuICAgICAgICAgICAge2NvdXJzZVRpdGxlfVxuICAgICAgICAgIDwvbGk+XG4gICAgICAgICl9XG5cbiAgICAgICAge0FycmF5LmlzQXJyYXkobGlzdCkgJiZcbiAgICAgICAgICBsaXN0Lm1hcCgoaXRlbSwgaW5kZXgpID0+IChcbiAgICAgICAgICAgIDxsaVxuICAgICAgICAgICAgICBrZXk9e2l0ZW0uaWQgfHwgaW5kZXh9XG4gICAgICAgICAgICAgIGNsYXNzTmFtZT0nYnJlYWRjcnVtYi1pdGVtJ1xuICAgICAgICAgICAgICBvbkNsaWNrPXtpdGVtLmNhbGxiYWNrfVxuICAgICAgICAgICAgICBzdHlsZT17aXRlbS5jYWxsYmFjayA/IHsgY3Vyc29yOiBcInBvaW50ZXJcIiB9IDogdW5kZWZpbmVkfVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICB7aXRlbS50aXRsZX1cbiAgICAgICAgICAgIDwvbGk+XG4gICAgICAgICAgKSl9XG4gICAgICA8L29sPlxuICAgIDwvbmF2PlxuICApO1xufVxuIiwiLyoqXG4gKiBTaW1wbGUgY29tcG9uZW50IHRvIHJlbmRlciB0aGUgc2VsZWN0ZWQgYW5ub3VjZW1lbnQuXG4gKiBAcmV0dXJucyB7UmVhY3QuQ29tcG9uZW50fSBUaGUgQW5ub3VuY2VtZW50RGV0YWlsQ29tcG9uZW50XG4gKi9cbmZ1bmN0aW9uIEFubm91bmNlbWVudERldGFpbFBhZ2UoKSB7XG4gIGNvbnN0IHsgY291cnNlRGF0YSB9ID0gdXNlQ291cnNlQ29udGV4dCgpO1xuICBjb25zdCB7IHNlbGVjdGVkQW5ub3VuY2VtZW50SWQsIG5hdmlnYXRlVG9Bbm5vdW5jZW1lbnQgfSA9IHVzZU5hdmlnYXRpb24oKTtcblxuICBpZiAoIWNvdXJzZURhdGEpIHtcbiAgICByZXR1cm4gPGRpdj5Mb2FkaW5nLi4uPC9kaXY+O1xuICB9XG5cbiAgY29uc3QgYW5ub3VuY2VtZW50ID0gY291cnNlRGF0YS5Bbm5vdW5jZW1lbnRzLmZpbmQoKGFubm91bmNlbWVudCkgPT4gYW5ub3VuY2VtZW50LmlkID09PSBzZWxlY3RlZEFubm91bmNlbWVudElkKTtcblxuICBpZiAoIWFubm91bmNlbWVudCkge1xuICAgIHJldHVybiA8ZGl2PkFubm91bmNlbWVudCBub3QgZm91bmQuPC9kaXY+O1xuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT0ncGFnZS1kaXYnIHN0eWxlPXt7IG1hcmdpbkJvdHRvbTogXCI0ZW1cIiB9fT5cbiAgICAgIHsvKiBIZWFkZXIgKi99XG4gICAgICA8ZGl2XG4gICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgYm9yZGVyQm90dG9tOiBcIjFweCBzb2xpZCByZ2IoMzksIDUzLCA2NClcIixcbiAgICAgICAgICBwYWRkaW5nQm90dG9tOiBcIjFyZW1cIixcbiAgICAgICAgICBtYXJnaW5Cb3R0b206IFwiMXJlbVwiLFxuICAgICAgICB9fVxuICAgICAgPlxuICAgICAgICA8aDEgc3R5bGU9e3sgY29sb3I6IFwicmdiKDM5LCA1MywgNjQpXCIsIGZvbnRTaXplOiBcIjI4LjhweFwiIH19Pnthbm5vdW5jZW1lbnQudGl0bGV9PC9oMT5cbiAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiBcImZsZXhcIiwgYWxpZ25JdGVtczogXCJjZW50ZXJcIiwganVzdGlmeUNvbnRlbnQ6IFwic3BhY2UtYmV0d2VlblwiLCBnYXA6IFwiMC41cmVtXCIsIGNvbG9yOiBcIiM2MzZkNzVcIiB9fT5cbiAgICAgICAgICA8TmFtZVByb2ZpbGVDYXJkXG4gICAgICAgICAgICBuYW1lPXthbm5vdW5jZW1lbnQudXNlcl9uYW1lIHx8IGFubm91bmNlbWVudC5hdXRob3I/LmRpc3BsYXlfbmFtZSB8fCBcIkFub255bW91c1wifVxuICAgICAgICAgICAgZGF0ZT17YW5ub3VuY2VtZW50LnBvc3RlZF9hdH1cbiAgICAgICAgICAgIGluY2x1ZGVQcm9maWxlQ2lyY2xlPXt0cnVlfVxuICAgICAgICAgICAgbmFtZVN0eWxlPXt7IGZvbnRXZWlnaHQ6IFwiYm9sZFwiIH19XG4gICAgICAgICAgLz5cbiAgICAgICAgICA8c3BhblxuICAgICAgICAgICAgY2xhc3NOYW1lPSdhc3NpZ25tZW50LWxpbmsnXG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBmb250V2VpZ2h0OiBcImJvbGRcIixcbiAgICAgICAgICAgICAgY29sb3I6IFwiYmxhY2tcIixcbiAgICAgICAgICAgICAgbWFyZ2luUmlnaHQ6IFwiMmVtXCIsXG4gICAgICAgICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgcmdiKDIzMiwgMjM0LCAyMzYpXCIsXG4gICAgICAgICAgICAgIHBhZGRpbmc6IFwiMC4yNWVtXCIsXG4gICAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCI0cHhcIixcbiAgICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcInJnYigyNDIsIDI0NCwgMjQ0KVwiLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcbiAgICAgICAgICAgICAgbmF2aWdhdGVUb0Fubm91bmNlbWVudChudWxsKTtcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgPlxuICAgICAgICAgICAgQmFja1xuICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cblxuICAgICAgey8qIEJvZHkgKi99XG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzTmFtZT0nYW5ub3VuY2VtZW50LW1lc3NhZ2UnXG4gICAgICAgIHN0eWxlPXt7IGZvbnRTaXplOiBcIjE2cHhcIiwgbGluZUhlaWdodDogXCIxLjZcIiB9fVxuICAgICAgICBkYW5nZXJvdXNseVNldElubmVySFRNTD17eyBfX2h0bWw6IGFubm91bmNlbWVudC5tZXNzYWdlIH19XG4gICAgICAvPlxuICAgIDwvZGl2PlxuICApO1xufVxuIiwiLyoqXG4gKiBEaXNwbGF5cyBhbGwgb2YgdGhlIGFubm91bmNlbWVudHMgaW4gYSBjb3Vyc2UuIFRoZSBDU1MgdG8gZ2V0IHRoZSBpbmRpdmlkdWFsIGFubm91Y2VtZW50SXRlbXMgd2FzIGRpZmZpY3VsdC5cbiAqIEByZXR1cm5zIHtSZWFjdC5Db21wb25lbnR9IEFubm91bmNlbWVudHNQYWdlIGNvbXBvbmVudC5cbiAqL1xuZnVuY3Rpb24gQW5ub3VuY2VtZW50c1BhZ2UoKSB7XG4gIGNvbnN0IHsgY291cnNlRGF0YSwgcmVjb25uZWN0Rm9sZGVyIH0gPSB1c2VDb3Vyc2VDb250ZXh0KCk7XG4gIGNvbnN0IHsgbmF2aWdhdGVUb0Fubm91bmNlbWVudCB9ID0gdXNlTmF2aWdhdGlvbigpO1xuXG4gIGlmICghY291cnNlRGF0YSkge1xuICAgIHJldHVybiA8ZGl2PkxvYWRpbmcuLi48L2Rpdj47XG4gIH1cbiAgaWYgKCFjb3Vyc2VEYXRhLkFubm91bmNlbWVudHMpIHtcbiAgICByZXR1cm4gPGRpdj5ObyBhbm5vdW5jZW1lbnRzIGF2YWlsYWJsZS48L2Rpdj47XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVIVE1MKGh0bWxTdHJpbmcpIHtcbiAgICByZXR1cm4gaHRtbFN0cmluZy5yZXBsYWNlKC88W14+XSo+L2csIFwiXCIpLnJlcGxhY2UoLyZuYnNwOy9nLCBcIiBcIik7XG4gIH1cblxuICBmdW5jdGlvbiBhbm5vdW5jZW1lbnRJdGVtKGFubm91bmNlbWVudCwgaW5kZXgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdlxuICAgICAgICBrZXk9e2Fubm91bmNlbWVudC5pZH1cbiAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICBib3JkZXJCb3R0b206IFwiMXB4IHNvbGlkIHJnYigzOSwgNTMsIDY0KVwiLFxuICAgICAgICAgIGJvcmRlclRvcDogaW5kZXggPT09IDAgPyBcIjFweCBzb2xpZCByZ2IoMzksIDUzLCA2NClcIiA6IFwibm9uZVwiLFxuICAgICAgICAgIHdpZHRoOiBcIjEwMCVcIixcbiAgICAgICAgICBib3hTaXppbmc6IFwiYm9yZGVyLWJveFwiLFxuICAgICAgICAgIHBhZGRpbmc6IFwiLjc1ZW1cIixcbiAgICAgICAgICBnYXA6IFwiMWVtXCIsXG5cbiAgICAgICAgICAvLyBUSEUgRklYOiBTd2l0Y2ggZnJvbSBGbGV4Ym94IHRvIENTUyBHcmlkXG4gICAgICAgICAgZGlzcGxheTogXCJncmlkXCIsXG4gICAgICAgICAgZ3JpZFRlbXBsYXRlQ29sdW1uczogXCJhdXRvIDFmciBhdXRvXCIsXG4gICAgICAgICAgYWxpZ25JdGVtczogXCJjZW50ZXJcIixcbiAgICAgICAgfX1cbiAgICAgID5cbiAgICAgICAgey8qIExFRlQgQ09MVU1OIChhdXRvIHNpemUgYmFzZWQgb24gcHJvZmlsZSBwaWN0dXJlKSAqL31cbiAgICAgICAgPGRpdj5cbiAgICAgICAgICA8TmFtZVByb2ZpbGVDYXJkXG4gICAgICAgICAgICBuYW1lPXthbm5vdW5jZW1lbnQ/LnVzZXJfbmFtZSB8fCBhbm5vdW5jZW1lbnQ/LmF1dGhvcj8uZGlzcGxheV9uYW1lIHx8IFwiQW5vbnltb3VzXCJ9XG4gICAgICAgICAgICBkYXRlPXthbm5vdW5jZW1lbnQ/LnBvc3RlZF9hdH1cbiAgICAgICAgICAgIGluY2x1ZGVOYW1lPXtmYWxzZX1cbiAgICAgICAgICAvPlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICB7LyogTUlERExFIENPTFVNTiAoMWZyIC0gc3RyaWN0bHkgdGFrZXMgcmVtYWluaW5nIHNwYWNlKSAqL31cbiAgICAgICAgey8qIG1pbldpZHRoOiAwIGlzIHN0aWxsIHJlcXVpcmVkIGZvciB0aGUgZ3JpZCBpdGVtIHNvIHRoZSB0ZXh0IGNhbiB0cnVuY2F0ZSAqL31cbiAgICAgICAgPGRpdlxuICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICAgIGZsZXhEaXJlY3Rpb246IFwiY29sdW1uXCIsXG4gICAgICAgICAgICBtaW5XaWR0aDogMCxcbiAgICAgICAgICB9fVxuICAgICAgICA+XG4gICAgICAgICAgPGg0XG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBtYXJnaW5Cb3R0b206IFwiMFwiLFxuICAgICAgICAgICAgICBtYXJnaW5Ub3A6IFwiMFwiLFxuICAgICAgICAgICAgICB3aGl0ZVNwYWNlOiBcIm5vd3JhcFwiLFxuICAgICAgICAgICAgICBvdmVyZmxvdzogXCJoaWRkZW5cIixcbiAgICAgICAgICAgICAgdGV4dE92ZXJmbG93OiBcImVsbGlwc2lzXCIsXG4gICAgICAgICAgICAgIGNvbG9yOiBcInJnYigzOSwgNTMsIDY0KVwiLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICAgIGNsYXNzTmFtZT0nYXNzaWdubWVudC1saW5rJ1xuICAgICAgICAgICAgb25DbGljaz17KCkgPT4ge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImFubm91bmNlbWVudC5pZFwiLCBhbm5vdW5jZW1lbnQuaWQpO1xuICAgICAgICAgICAgICByZWNvbm5lY3RGb2xkZXIoKTtcbiAgICAgICAgICAgICAgbmF2aWdhdGVUb0Fubm91bmNlbWVudChhbm5vdW5jZW1lbnQuaWQpO1xuICAgICAgICAgICAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICB7YW5ub3VuY2VtZW50Py50aXRsZX1cbiAgICAgICAgICA8L2g0PlxuICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgIGNsYXNzTmFtZT0nYW5ub3VuY2VtZW50LW1lc3NhZ2UnXG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBmb250U2l6ZTogXCIxNHB4XCIsXG4gICAgICAgICAgICAgIGNvbG9yOiBcIiM2MzZkNzVcIixcbiAgICAgICAgICAgICAgd2hpdGVTcGFjZTogXCJub3dyYXBcIixcbiAgICAgICAgICAgICAgb3ZlcmZsb3c6IFwiaGlkZGVuXCIsXG4gICAgICAgICAgICAgIHRleHRPdmVyZmxvdzogXCJlbGxpcHNpc1wiLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICB7cmVtb3ZlSFRNTChhbm5vdW5jZW1lbnQ/Lm1lc3NhZ2UgfHwgXCJcIil9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIHsvKiBSSUdIVCBDT0xVTU4gKGF1dG8gc2l6ZSBiYXNlZCBvbiBhdXRob3IvZGF0ZSB0ZXh0KSAqL31cbiAgICAgICAgPGRpdj5cbiAgICAgICAgICA8TmFtZVByb2ZpbGVDYXJkXG4gICAgICAgICAgICBuYW1lPXthbm5vdW5jZW1lbnQ/LnVzZXJfbmFtZSB8fCBhbm5vdW5jZW1lbnQ/LmF1dGhvcj8uZGlzcGxheV9uYW1lIHx8IFwiQW5vbnltb3VzXCJ9XG4gICAgICAgICAgICBkYXRlPXthbm5vdW5jZW1lbnQ/LnBvc3RlZF9hdH1cbiAgICAgICAgICAgIGluY2x1ZGVQcm9maWxlQ2lyY2xlPXtmYWxzZX1cbiAgICAgICAgICAgIG5hbWVTdHlsZT17eyB0ZXh0QWxpZ246IFwicmlnaHRcIiB9fVxuICAgICAgICAgIC8+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzc05hbWU9J3BhZ2UtZGl2JyBzdHlsZT17eyBtYXJnaW5Cb3R0b206IFwiNGVtXCIgfX0+XG4gICAgICA8aDEgc3R5bGU9e3sgY29sb3I6IFwiIzY2NjY2NlwiLCBmb250U2l6ZTogMjguOCB9fT5Bbm5vdW5jZW1lbnRzPC9oMT5cbiAgICAgIDxkaXYgc3R5bGU9e3sgd2lkdGg6IFwiMTAwJVwiIH19Pntjb3Vyc2VEYXRhLkFubm91bmNlbWVudHMubWFwKChhbm5vdW5jZW1lbnQsIGluZGV4KSA9PiBhbm5vdW5jZW1lbnRJdGVtKGFubm91bmNlbWVudCwgaW5kZXgpKX08L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cbiIsIi8vIElubmVyIGNvbXBvbmVudCB0aGF0IHNhZmVseSBjb25zdW1lcyB0aGUgQ29udGV4dFxuICAgICAgZnVuY3Rpb24gQXBwQ29udGVudCgpIHtcbiAgICAgICAgY29uc3QgeyBjb3Vyc2VEYXRhLCBjbGVhckNvdXJzZURhdGEgfSA9IHVzZUNvdXJzZUNvbnRleHQoKTtcblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIDw+XG4gICAgICAgICAgICA8bmF2IGlkPSdzaWRlYmFyX25hdic+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSdzaWRlX25hdmlnYXRpb25faXRlbScgc3R5bGU9e3sgaGVpZ2h0OiBcIjg1cHhcIiB9fT5cbiAgICAgICAgICAgICAgICA8aW1nXG4gICAgICAgICAgICAgICAgICBzcmM9J2RhdGE6aW1hZ2UvcG5nO2Jhc2U2NCxpVkJPUncwS0dnb0FBQUFOU1VoRVVnQUFBREFBQUFBd0NBWUFBQUJYQXZtSEFBQUFJR05JVWswQUFIb21BQUNBaEFBQStnQUFBSURvQUFCMU1BQUE2bUFBQURxWUFBQVhjSnk2VVR3QUFBQUdZa3RIUkFBQUFBQUFBUGxEdTM4QUFBQUhkRWxOUlFmcUJCQVRHaC85MTRrY0FBQUFKWFJGV0hSa1lYUmxPbU55WldGMFpRQXlNREkyTFRBMExURTJWREU1T2pJMk9qTXhLekF3T2pBd0pDSzllQUFBQUNWMFJWaDBaR0YwWlRwdGIyUnBabmtBTWpBeU5pMHdOQzB4TmxReE9Ub3lOam96TVNzd01Eb3dNRlYvQmNRQUFBQW9kRVZZZEdSaGRHVTZkR2x0WlhOMFlXMXdBREl3TWpZdE1EUXRNVFpVTVRrNk1qWTZNekVyTURBNk1EQUNhaVFiQUFBWWZVbEVRVlJvM3JWNmQzUmQxWlgrdDgrNTdWVTlWYXRMbHVRbTJ4ZzNNRFlHREE0OUFXendEMEpKSXdraFFFSkxNcUVGVEJaSmdJVG1TZUlRSjBNTkxUQnh5QzlnSEtvTkJseXdUQ3dYeVpiVnJDNjlmc3M1ZS82UWFHa3pyRFZ6MXJ0dnZiZmVMZC9lKzl2ZjJmdWNCL3d2alAyWGZ4MEhBTFRGd3RoM3luTFJQbk9HMlE4SU1BUE1HQVZFKy9RcDVwN2psNGlEQUhvQjdMMzRnditOUjhQNHRCZnN2dTVxbU85dUFRc0pIWWtTQ1laS2pYSWRnRVBsNVZMWmxwTE1tb1VBRXdFQWhxV2hDYVMxSWNGMVZYTFp3UzcxOU1vejBIcm1LY1NDSVZ5WEFjQ2JPUXV6ZjdybS85YUE0UFhYUVlZRUpDZ29TckEwQUxSMWlpVEFzR3hGVG1pYWpzVyttSjR6NjZnTWN3VXpBOEFBMi9aV1dOWTZOcTFkdTRobzM4bEx5YXVvMGt3QjdJRmhBb2lOMXIyZk9nTGlmM3JpMEF2ck1mVEMrbkZXRUpFV2d1RTRoYkN0MGtBSW5abzdoMVZwNlZldDF0WldNNW44bnBITG55ano3Z3pEOVdZWXJuZWNtVXBmN1hUMnRPanlTZGYwSEhFRUJ5SFNiRnJGT2hxSlF3ald0azNCcEZLOERPQ0xBTjYvOWlyb2pnUC9MUzc2Vno4ZVdyc0dtZlYvQkUydUI1UUNkclpJbVVxTHBoMHQvdHNYWDVnbzNkWHlMc0JWcWVMU1dYWjFlY3JlK2w2ZjhEeEFDQStBL09EK0REQVltcGhOYlJyd21xWTA1bXBpZmJFMzN1dUFGQjBiM3RteDhESkFNeEVkbkRGTjVpckxOWTJOYVNPVFJXN1IwVGppTnc5LytnanN1L3BLZURmZEF0SFdCbXJaSmF2WHJDVW1VaktYOS9jZU14OTJUMmNsK1g2anpPYWQ4Tmp3MWJtbWFSN0FIN2prRTQ2WitNSU1Ca2tCY2NTc1lhZWw0N09HNnhXVHJ5Sm5FK21KZkdFUUFqOFMxcVpTUnVIdXZXaFo5eEIycjFyeDZRelk4NDFMVWZxeisyRU9Ea0k2anFFdFUyVUJadHMrS1lqSGJoT2c2dzY5dEg2L01zd1hpUWlVOTVjY2Nkc1BSLzJDMkxlVVlRS0FDV1lKWmpGeFNDSlliRm53WTdITCtZV1hSZ21DQXR1R1gxT3hZdXlrNDg5cW16dTd2ZTNJMlR1Q2FQVEhPdVJNWWltRFRFMmwwUVVndlhnUldpODYvMzlHb2IwMy9SdU0yKytBd1lBL3JjblFSWW5BS3l0cmRycDYxZ3JYWFVKS0F3UUUwZWgvN04veXd0ZW56bDNXcFVHN3JIUnltWmNvZ0ZjeWFhbzVOUGhsb2RTeFFxa0NJbUpGTktSTTR6V3VMUDhQMmRQVExqTTVxTCsyUVYzenJkalV1KzlPdFI4NWE5ak11WVZNQWlCQUdVYldMMHA4eWV3ZmVOTG82NWMxdzZNcUNhRHIrbTlqNXAzM2ZBTHYzNnZRNWszUWpYWHdJMUZEaDBJQmlrdE9DeDg4OUx6SXV3UWlCYUlBU3R2QzkrZlBseVh1USsrK1BHbjV6OVkwb2JQdkNpYm14SVl0YTdKekc3NW52cjhiVzU5ZUYyVUNMN2pvbXhsTXJvTWFIa0pRTVdtZTd1Nzd0cDQ3YXlqOGhmblhiUjc5ZkxUODdSMktpUUNDQXFDbDc0ZkYwUEFUZm1sSklRdnh5NDdpWWtNTURnWld5NjUvSFlIM2Yvb2ppTmRlZ3h3YWx0b3lsUTZGRm9VNnU5K1ViZ0FXNUlQWkJPQ0QyUXlpMFVjb25iNDRtTmJVYkhSMC9sbTZYZzBMUWo0YXZTTFUyYlhHclNoL3hQTGNjOENBYjFwUE9tTkRYeHFkM0RBak1qQzBVM3FCd1FUNDRkQnprZTZ1YzNKVjFldU5UUFpNRVBrQVRBQUt6RkliRW01WjZUTGgrNitRVWhLMXRXcks3NTcrNXprdy9NVFRnTzNRMEpjdlZsMS9lc2EwdXc4L0p2SWVXRkF3QVo3QmJHZ3A0VWRDOTRZSCtpRVBkVDhpYzI0Tk1lZkFBREVka2xLQ0NDNkR3RVJFVWhMWkZneEJFZEpzZ0JsQ2EwalhQYnZqYzZmR3ZVVEJ6ZG93QUdZRGdBWWdRUlRJUU1FYUdmMzNLYSsvaWVjMmJWRUIwZDlSL2hNR2lIZ001cjQyV1hyL1d0UXVPL05Tdy9VbVF3aC80c1lNWnArSnlBK0g3NkJVK3QzU29WRkFxMElJUUJsR3lJdEVmaEJwYjE5ZjFkbE5ZbkRrS3p0UFBibHM5MmMrVXlaNis3OVl0YnVkblAzdDczcUZpYk9Ea0wxTFdSYll0amRPV2Z0SVVvNGx0M3Z4MlBjZ0pkSDR6S2NBR0V5a2hPZlAySGZja3BQUFhuSTBqSU1kNGg4YTBQcmRxL0grNGdVbzNmSUdRc2trQ2c1MWdUTFpVNkExUU9BSjJoQUxzb0pvNU1IUXR1M2YxOUhvcWozSEhidlFyNXAwc3ArSTMreFdWc3czaDRadXJSb2N3dXUzM2dndGhMUlNtWXlWeWFhMUlQbERaamE3dTRueStmOXMyTkV5MjV2ZDNEQnA2NDdsUThjdk9rbEh3bCt5LzdyN3gxNDg5bjBsaFp4UU1BWEFJNjBnY3JsbVl5d0Y4anl4Yy9aTXRNeWVpWDNmdXZJakE0eHQyeUJ0RTJyK0FxcmNmeUJJVlZXQVRETU5Ja0N6eFJNVGtCK0wzV3EzL1BXcitZWHo3bkVHQjU4dzArbnZXQWU3OTVIbnJZYnZieE91SzErNzgwN1U5ZVQ0M1pPUFVzOGY0ZURSR1Q1Mm5yNUV2VVFFeTlOTW1pVUFaSmNjYzJCZzZoUlFLdjl0WjNCb1hUQnR5djFPMTZFNzNLTENzd1BiYm1jaEpET0gyRFNoYldkenZxUVErMDg2MVpkQ2tBR0NmbWtEZ1BIWkVsYzJUUWFEQ1FBZlduNWMzTFhzUlA3WVU1NjF1dG9hV2NoY1lOdlArVFZWRjJCazlObDhWZVVxSjVtNml3d2pvNm9xTDlUUnlJREk1MjFJeVEyN2R1dHRCMS9GcmhxSmJFV3RMQnZ6aktveEpUbWVFRHY0SGQxZUFoeFYwTWk5UjgySHMyMkhvYUloelluQzdUS1Z1a1RrM2FYNXl2SVdCT3E1S2U5dXY2OXZhc003Z1dHK3B4T0YxOWhiM3RtZW5WemRiUHJhczRhSDgwUWdFUEJBMzhDNGpISWtUUGxaMHptb0tIZUsxejI2R1hsdnBoNGF1c0xzNmpuZjdENE1yN29LNlhpc2tldHJTa1gvU0VjUWlUeXJ5eWZkSVB2N2QzTStMem1iZFRNbm5JQ1crbnFjOC9CajVPNTdsYnZtalQ0alhYY2hDQWhNNDkyTHR1TXNBZERPY3hMc1NZbEVSMmNBeDVHd2M2M3BTZVVMdzhteEcwaGF1N09GNGRLV3p5eVRvZVRZbjNRUS9NbHRxQ2lYeVdtdngvc0dqNDMxang3SzFOZlAxNzQvYU9SekJJQUZBTEJpK01LQ3lpdldnYmFrMXBDajZRZmNhZE5PVTNObXdTOHZlenpTUDdBL3ZQOUFsM2FNSkZMSkZhUjVOK2Z6a2pJWlJaNkh5a1dMSVhsY0pHd0FodVlHcVhUbCtNSDFIMlNmVUJyMXF5NEVxUUNVenlueVBRbXQ5M0kyODRVOHRGOXdvTE1qM3RkL0VMSG9JcitrYkVwMGEwdXZsY2tlSzd3QVJGeWtMU2EyQ1V4Ni9INXRGMThJanNjNXZ1TTlFV3R0Y2ZmOWZtMnpXMUo4amhlT1hCR2M5Wm1OYmpSK25wbkpuaStVeXN0QVdWWTZlNHhLRkFDREF4YnllY1YrQUQ3akRFdzZkeFdzb2tKZ1FnZFpTcDhCOERodTk2T1pSNkQwbkJWUXkwK0UxZ3lkeXl0N2RNVFMwb0NUeVo0aEF4V1NmbUNiL1VOUEdkcGZ3SXIzQktIUWRsVVErN1ZiWExyQTJkczU0SFFjRm5vMHhSM1hmZ3RHK09GSHNZVVpKeEx4VUcwdEd0djdadXBZdk5YbzN2ZWNmT2IvQXdSSlJDQ3RIVzBZQ0VxS1h5VS9BSGxlZ05OT1Era3hpNUU0OWZRUHdlSGpTRUVmV1BDUmZrOThtdmFyMzJMZ3VXZVE3dWhBOFBUdkEyMFlnR0c4ekRrWFVDb3ZBbFZ0cHJJVjRZNUQwK1BKRkpJbGhiQ2xnY3lzR2RDRHc3QTlEKzdMcjhEd0FjeVpYQ2VIcGpZcVhWWjJyWFc0OXk0bWhpNHJ2bHYxZGx6M3pONk5UNTQzZjlXbGh1ZWRwQ0xoRzhLdGU5c29VRExiY1VqTmVPWDFUMnF5WlFMQWVBdERSQVFhbHdZYTEySUNRT0lqSTB2UFhna0EyTWlzbXlyTEpWdld6cUNzN0M3S1pLNGpaakM0T05NOERibmlndm5jTS9BZ0FDV2MwRmNRamJ6SHZpM1pzcFRoTFR0ZWFNTlFaRm16ekVNZGR3bWx3TXdhcWZTMXVtSHFzeXRQL01xbTFKTEZaNFlPN0t1S3Y3cWw3US9KSkthOXVWRlZMbDRPQU5oOXdYbGdyUUVpNkd5V0FMQ2FBTXNmRUdpQ1NnUkFDRW43THJ5QW1SbkNrR2g2NkZGa0FDUlhuS00yUC9Cem5FVjBmZnFZb3c0S3BSYUpoc283aCtjZDZ4US85dkNmVE5jdFl3WlVkODhMdWFYSFR1SGtXTW84M0UrRzdPMlZCcUJWUEhhSlVCb2c4a0VFb2JYQTRQQ0ZSaTYvNmM5LytYZjMwdktDdHJuSkpKNzV4bGZKWnMxOC9ybllLd1ZxSDMwU05vRE9JMllJTTVPalBrREg4VEhrSCtOUFdnaUtiM21MZ25DWTYvYTA2d3lBUFNzL0N6NXZKYlFVT09yNmEyZ3hNNzh5dVhZTkRZK3U4VXdEaVk2bnJwS2VYd1loWEFKQmV2NGsrOTJ0WHhhNTNMMGdrc0pwM2F1c3R2MHdmSC9odU5jZ01MR2lJSldlYjNSMDRMd0Y4MzR6VnR2MDFCc1ZrMUQrMkJOa1pUS1E0UkJxSG4wU0dRQTlUZldTRGFrNW5WYjNNWFBvWTZnSkFJRWdBTVNVMGdoOHBRMnB1K3FxWkE1QXd6UHJJVzBEVG5FUkVvODlUaHNuMXlJb0svdWxONlh4RjhiK2RralhQNDJZQVpBQndDQUF3blZQTWpxN1lSdzR5S0tDV1ZmNEdzd29tM2dnRVlGSUVFQ0l2ZitMTlZIRHpaOGpjL25QZFo5OGNrSC9TU2RxN3UybjVMcUhNUVFnMVZndnZYaGMrWkhJeW14dHplUFhGOGR4YUR3VFBpUTdFOFJvTElMRHRrUyt1dll4blNoYzVSY1ZxZXpVUmprTUlQSG9rOGp0YjZmRHk1ZnJBK2V0Q2xNMmQ3RjAzUXMzSCs2MWlYVTV4bXM0K3NBdGdybTJlbWdZMWFOSkpmaWpBaytOTjMzajhXZk5JSVkvdG1xRnp4L1FPQlpWc0cyUUVIQUFlTE5ueXFDZ1FLbEV3U25tYU9wcEs1TTlmNmh1OHUraUFJamgwMFFDRTdOdnBqTEl6SnI5T3l1VHZjQVlTejJob3BGVFZDU2lzck9icFY5V0RvQWhjbG1ZSTBNR0FTUklVUEZ2MWxuUWJIeVVSUitTMGdLQWM1aEJIZEd3aEdFcWJteFlMM1BaTXhta3hzOW5xUnpuejdLMzU3U2dxbm90RVFuWlAzQXBmRSs0cHl6WDZPd1JRVGlrWVpxVHcyM3Q3Y0x6d0VSNVpuYjhXT3dSUStsbW1jM01BNERBc2Q5UmhySGJ5bVF1QVNnUHJSMjJUSGdORFkzaysrMGlseE9xdWxhSDFqOG5PQlRTcXFybUtXYnRXeTB0bjFjelo3MU51ZHhDQ0ZManNzeVNiZnQxZS90N3h4RWc2TURjT1FhQVFEdk81V1p5YkEzeCtLVERnTzBYRkZ4RlF0eHZ0TFJBUktNWXVtTTE3RmRmSXprOHdoUXc0bjk4bmdCd2R0RlJOOHAwYWpVcnJVR2tBUmdUbnArZ0VBSE1JQ0FBUXpCQjZGanNacm5sbmRVQ0lPL00wOWtyTElTeVRNcjh2MVZjOWJXdm9lSmdGenFiWjBCRndnOFltY3czQWZnVDJtWUdrY2pkTXAyK2pnRlR1Sk1tcVpGNTh6QzhlUEZ2dFduMWd0a0dzNjB0cTg4N2F0RnZKbTk2RTZxNStiNmdydTRuY3k2NUZMcTBoT0U0eE9FUXhpNjRBR1hNa0gzOXQrdkNvbHNnaENCbUlvS2FTTHp4MXpoNEJRYXhnRkR4K0UxeWNHRDFLOHpJcjF3QktvZ0RwU1ZFdFRVOCtlVFRrWjB5WlVuYmVhdUszYklTQkluQ2g3U1FnR1lEckUyV0VxcXc4TGRlZVFWVWFhbWkzY2N1Z2VsN0VsSXF4R0t6NWNEQU9nQVdseFo5d1FQdFlPWjU0ZDdEVzBrcHFGanNsN0t2L3pMeVBKbDY4bkZsclhzSWlFWXBmTi85SXFpclZseGRjNk1ZRzEwOVhzdVRHRThGSG45amFCWWtWVUg4Smprd2NMdlYweTNIVnAydnBldXk4NDNMb0ZhZUs5bHhsSzZwdmtlT0piL0ZqcjIxNDRyUEw2Nzk4Uzg5blNqK2taRk9meGNBZERUNlhUazArQlA0dm93Y09LUm96NEo1TUxJNWFNc1VuRWpvV0dzcjRMa0l3VWZCY0JZdi8vb2h1L0hlbjNRSnp5dlJsc1g1eHZycDVQdDdoZWNMbzZCUTYrSVNzRzFUNk43N2hHcW9WN3FpOGtZeE9yb2FyQlVUQ1RDRHh0ZEtwUzRvdUJrSEQ2NDJldzdMOUZlL29qbVZZak9WQnJ0NW9RMVR3ekpuV3djTzdKUys3MnNwVGIrNGVDVnI5WHZ6VUJmeTh4ZE1FV05qSVd2dm5wMTFYZDNZZEtnVGMydHJJSzgrZHdXRXF3RFdCTVdjbXp5NUhtSDdEamRlZU10SVNla3Q4ZmJXVGdRNkpYMy9LR2FtUU9tWHRSdTB5cnhuWXRmN0NsMWRvT3BxK0V1V3dQenppNUpOK2FvdUxWSEM4MDRpWmcxbURTRU1MaXo2Z2VqcnUwMTBkTXJjNVpkcHVDNGJiVzJnWEE3cytTYW5Vb3BjOXl3emwvc3NNVXN0SkJCTDNLZWtMaEtHZWFPUlN4Zm9hYzF2cU9Kb2ZxeTJSb1JmMmNqWk9YTWdHdTliQTIwUXFhWW16YzB6Q3AyKzdxMXlMSFdaek9VWEdzUlZsUFBjMFl0V2ZpY0lPUzNhZHJiN3h5eDV3UmthaEloRVBWRmNLSVdiaFh6bEpWQTJ4L2tydnFsbCswRXBlbnB1MXdXSm0wRWtJY2pRaFlVLzRJUHR0OUwrZGhsY2RhV1d2cy9HL24yZzhXVklRVE5uZW9aVzhCT3hGNVZsZGl2TFNuSXNmcHM0MkxaWlp2SVhHdm5jRmNabzhnRnI2OXU3OVp5NUVYL3VrVm9HaWhvZmYySzhwV1JmUVNXekNKSlpFR01JdG9uQWNkN3h5c29XVURiN2JPd1BMMlRydDcxM0JHM2ZNVSs4dVhtYWpzZWZvbWgwam9oR0ZSS0ZFcmtjeE9nSUtKZG45NHB2YW5tZ1ExSjM1MnBkVVBBakxpeTZrem83YnhWZHZWSmZlWVVXMlJ5TDBWRndvQURMRm1SWm1qMTNFam1odSsyMFcvanU5cDExbWFWTHE1Qk4zeEtVbHNEWjIvb2RIWXMrb0tVQURCclJtUnh6TWcxVzZxTXlwWDN4WW1pQVdBaE9McGdYQ2U5cnJZMjk5dGJ1b1d1dWRzSWJYanlQRE5ubkhyM2dEZXYxVFZrVzhteDdkUFJaR0liSGpaTVh3YzF0VjhOakZrdFQ4ZHc1U3JnK2RLS0lTdS84Q1RJbENkYStEMnNzUTdudmZ4OWlkSVJwN1lQSW4zRXFpWHhlY0RTcVJDUlNKWGJ1M0VTZVY2ZUtpcTVnMzErVG56VTc3dXpkZXk1N2JqVVZ4Sjh3ZXJ2MlpHcnFwM0Y5YmErMWYxK1NBQklnYm5qeDVRa0RqbDRFTGNhWHpWTkh6bUducHd0K2FWazB2blhiZHBuUE4wRUlzQ0Y3Z2xEa0ZuUC8zZ2ZWNUlhN1JDWjlyWExDejFNcWVhWlhWQVJobUVpOHNVbU1uUDFaSnROaW1qYWR6RWNlRWxvcDZFdStwSDBoK0lYYmJzTlpzMmZKd1pVcmxSR0xJYkYyTFZROC9vaVJUVi9Jb2ZDejF0YnRLN0pMRm4vWlNDWHZFa29WUW10b3l4N05UNTgrbmJPWlBsMWJEbnZQUGlLQWlRUWFOcnd5VGlIL21LT2g1Ymg0eDlzUEdMYW5FZWtmYkphKzMwU3NmZEpLQ2Rlck5KSmp2d3JxNjM5aHZiMzF1bnhCWWtYZ09MZW41OHdwSktLdnNHVWVFeGhDUXdqV1VwRHg0SVBVYy9ycHFuL3A4Y3E4OXo1S3hjSzRpZ2dzU0tuaUlpZThlVk85bVJ5Qmx1SmhsVWhjRmRxNmZVWHVxSVdyemRHUlh3dmZLNFRXUHNDdTBDcGg1SE9ObGxLdzJ6c041UWVzbEViUVBQdHZPcVdKMFhiVzV5aGZXY1VJaGVMUmpSdmFoTytWZ01UNFpoZXpZaUl6Q0lWL3FwVzYxampjQjY2dTJpQXptZVVzQkhRbzlIUjY1ZGtYcWVKaU43SDZEclJkL3ZXUTFYMVkxajN4WkxxbXZ4ODlGYVhJTlRSK3cwaG5iaVN0SzNVb2RDZW5VOStCWlVQYjlsVm1PbjJ2WUIyQWhBQXpBVXphdElheVM0NXZRajQvYWczMFVlUDY5Zit3VlA5d1pJNDdIc01qZ3dZTEVRU2gwSzFtTW5uelJFOXJnNGloTldzcGhWOVVkTHpkM2YyYVNpUTJHTm5zY29CemlrVElMU24rbkRVeXRKN0QwZnRGTHZkRjFpelljWjQxaC9vdnl0UTN6bkw2QjFxa0NxQ0pvS0t4KzluenI4b1hGMDhQRC9TL0x3TlBnSVRHZUVudmdka0tJckdmR1puME5kRGFLRWNRbUh2YVA5a0YvcTBCVEVDcXZsN3QrTTUzTWZtdHQyOVJ0djBXd0RZQWw1a0JJazFLUVdaemx5c2lCSTV6UzJCWldXVVlJZTA0RzRKdy9EV2pwUldzdEFYTmtnQmlyWTNFZ1M2d0hlcG4yMnhUcGdrZGo5OXA3ZHgrRlVQRFRxZStLQUpmTU1oblFERGdnYldsTFB2QTJLbG4zREE2YnlGeXRYVXFzSzIvaGZ2M0VkaDE0UVV3aG9ZaDgza1J4R0k2TjJOR3BHakRpeThJMTEwQzFnQUpqMWhiS2hyZEhudG4yN3lSSTQ5QTM3Smw4Y0tkTzZmTTJQankxbjFubmc2anJ3OUdUemMydnYyNlUvMkhQOXF6cjd4dXpHMXFoRjlVaEZ4NVNSbXpjSnpCa1Jud1BIWU9IbnhSMTFTOUp0THBwU1JGSHN3R013eHRXb051UThNaU1UTGFKbHhYYXROVWZuVTFtaDkvL0Y4YkFBRDdqMXNLK0Q1Z1NPbVhsS2pwei80bjJoY2RmYXVSeTE1SlNoWHllRTF5dmRYUmZWZXVxdXpua01iTFNvZ25SY2lDYXBwV1pPNXN1WWpjL0NtQ2RUa1lOZ3VSWXlsM3FHajBDVXFQdlJRNjFBMjN2S0pEUXRmbW1wdW4yQWNQWFNKVHladUlHU3dGdEdGdHpOYlZYV1FORGg0V21hd0Izdzg0RkVMRHd3K0Rway8vMXhRQ0FEcnhoUEZTV0NrbHg4YkVBMGtmSWpsMlMzcngwZ2EzcE9SMHY2ejhPSEZvLzEyNXFrbDNXOW5jWmRMenZ4QTUzQWVoOU9taHQ5NDZZQ2JIN2pYeStkT2w2ODBUbmpkVDVuSUx6RXptVW10Z2NJTVF4ajJWL1lNZ1NYM0M5MkczN25sNDhwdHYzYXlpMGV0VkpQSmpyN0Q0eE1qMkhjdEZObnVZWEZkU1BoZVE1d0VubnZCMzRQOXBCQUJnenczL0JucGpFM1FzQm1YWkZObjl2c3dkYzJ4ZzduNGZnZVBBTlVWRG91ZHdtd2dDcUhqMC91ZTNiTDM2akNObnA2WHJPVXprRWRHSHU1UWdqTmVqek5CQ0d1bkdwbG5obnM0dkdabnN0ZHFRU0phV05JZlM2ZDNPYUFwdVNRbUtONzhwQm81ZkNwSEphc3Jub1plZGdLYjcvL0VHK0QvZHBaejJ3enN3OWRYWGdFbmxpRy9aek1id1lHRDFIeVp0U0dQbFgxNUdwcnl5SDVhNVU5dVc1OXVoWHl5L1lGVWhhZTJBQ0JBZjlha2ZXNTFqTUJzUWdNeG5YTGVzNmw1dFcwa0l1UzliV3RIZCtQWTJDaHpiQkxQcy9lcWxPcGd4USt2U0VsaGYrL28vQmY4dkkvRFB4dnVMajRZcEJVRUlEaVpQaVJqS2RjeU9nME95dHgrcXBQamJJcDMrR1NrRm11aG4rR09xclEwSkhZdGZqcjYrbit1NkJuaVZaUWtaQUdqZlB3cWx5Rk1CTjY5Yk4rN1owbEpRVGQxL2krZFQvOVZndk1NQ1F6T0pYQzVEcERJSXRLaloxOFpkaG5sUHZyTHFMM0owNUJLcC9JWFFYQVpBTVZHdnRzd3RYa25aYjUzT2p2MVcyd0hLVlZZVCtmNG9lUnJqa3hhWWhJQ2N0K0JUd2ZuVUJ2RE1JMkMwN2dZSUxJWUhDWUtneWtvMU1hTnphcE9FNysyVW1jeDF6cjY5S0ZQajd1K05SZUhWVkFNRlBpaFFzZ0pRYlFWeE5vZUdpVUFRUkF3UTZOaWx3TFlkLzdjR3pGcjdxMC9ZQXdCN1Y1d05sd2g1UUhsbGt5UUFJUlNyWmN6NkZRQzlJVWNDRU5MM0ZCL3VWWjBDMExFWXB2N3grVStVQmRpNjlkUEN3WDhCR0RlcG9iUWJGRFFBQUFBQVNVVk9SSzVDWUlJPSdcbiAgICAgICAgICAgICAgICAgIGFsdD0nJ1xuICAgICAgICAgICAgICAgICAgd2lkdGg9JzQ4J1xuICAgICAgICAgICAgICAgICAgaGVpZ2h0PSc0OCdcbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J3NpZGVfbmF2aWdhdGlvbl9pdGVtJz5cbiAgICAgICAgICAgICAgICA8c3ZnXG4gICAgICAgICAgICAgICAgICB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnXG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9J2ljLW5hdidcbiAgICAgICAgICAgICAgICAgIHZlcnNpb249JzEuMSdcbiAgICAgICAgICAgICAgICAgIHg9JzAnXG4gICAgICAgICAgICAgICAgICB5PScwJ1xuICAgICAgICAgICAgICAgICAgdmlld0JveD0nMCAwIDI4MCAyMDAnXG4gICAgICAgICAgICAgICAgICBlbmFibGVCYWNrZ3JvdW5kPSduZXcgMCAwIDI4MCAyMDAnXG4gICAgICAgICAgICAgICAgICAvLyAgIHhtbDpzcGFjZT1cInByZXNlcnZlXCJcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICA8cGF0aCBkPSdNMjczLjA5LDE4MC43NUgxOTcuNDdWMTY0LjQ3aDYyLjYyQTEyMi4xNiwxMjIuMTYsMCwxLDAsMTcuODUsMTQyYTEyNCwxMjQsMCwwLDAsMiwyMi41MUg5MC4xOHYxNi4yOUg2Ljg5bC0xLjUtNi4yMkExMzguNTEsMTM4LjUxLDAsMCwxLDEuNTcsMTQyQzEuNTcsNjUuNjQsNjMuNjcsMy41MywxNDAsMy41M1MyNzguNDMsNjUuNjQsMjc4LjQzLDE0MmExMzcuNjcsMTM3LjY3LDAsMCwxLTMuODQsMzIuNTdaTTY2LjQ5LDg3LjYzLDUwLjI0LDcxLjM4LDYxLjc1LDU5Ljg2LDc4LDc2LjEyWm0xNDcsMEwyMDIsNzYuMTJsMTYuMjUtMTYuMjUsMTEuNTEsMTEuNTFaTTEzMS44NSw1My44MnYtMjNoMTYuMjl2MjNabTE1LjYzLDE0Mi4zYTMxLjcxLDMxLjcxLDAsMCwxLTI4LTE2LjgxYy02LjQtMTIuMDgtMTUuNzMtNzIuMjktMTcuNTQtODQuMjVhOC4xNSw4LjE1LDAsMCwxLDEzLjU4LTcuMmM4Ljg4LDguMjEsNTMuNDgsNDkuNzIsNTkuODgsNjEuODFhMzEuNjEsMzEuNjEsMCwwLDEtMjcuOSw0Ni40NVpNMTIxLjgxLDExNi4yYzQuMTcsMjQuNTYsOS4yMyw1MC4yMSwxMiw1NS40OUExNS4zNSwxNS4zNSwwLDEsMCwxNjEsMTU3LjNDMTU4LjE4LDE1MiwxMzkuNzksMTMzLjQ0LDEyMS44MSwxMTYuMlonPjwvcGF0aD5cbiAgICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgICAgICBEYXNoYm9hcmRcbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSdzaWRlX25hdmlnYXRpb25faXRlbSc+XG4gICAgICAgICAgICAgICAgPHN2Z1xuICAgICAgICAgICAgICAgICAgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJ1xuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPSdpYy1uYXYnXG4gICAgICAgICAgICAgICAgICB2ZXJzaW9uPScxLjEnXG4gICAgICAgICAgICAgICAgICB4PScwJ1xuICAgICAgICAgICAgICAgICAgeT0nMCdcbiAgICAgICAgICAgICAgICAgIHZpZXdCb3g9JzAgMCAyODAgMjAwJ1xuICAgICAgICAgICAgICAgICAgZW5hYmxlQmFja2dyb3VuZD0nbmV3IDAgMCAyODAgMjAwJ1xuICAgICAgICAgICAgICAgICAgLy8gICB4bWw6c3BhY2U9XCJwcmVzZXJ2ZVwiXG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgPHBhdGggZD0nTTczLjMxLDE5OGMtMTEuOTMsMC0yMi4yMiw4LTI0LDE4LjczYTI2LjY3LDI2LjY3LDAsMCwwLS4zLDMuNjN2LjNhMjIsMjIsMCwwLDAsNS40NCwxNC42NSwyMi40NywyMi40NywwLDAsMCwxNy4yMiw4SDIwMFYyMjguMTloLTEzNFYyMTMuMDhIMjAwVjE5OFptMjEtMTA1Ljc0aDkwLjY0VjYySDk0LjNaTTc5LjE5LDEwNy4zNFY0Ni45MkgyMDB2NjAuNDJabTcuNTUsMzAuMjFWMTIyLjQ1SDE5Mi40OXYxNS4xMVpNNzEuNjUsMTYuNzFBMjIuNzIsMjIuNzIsMCwwLDAsNDksMzkuMzZWMTkwLjg4YTQxLjEyLDQxLjEyLDAsMCwxLDI0LjMyLThoMTU3VjE2LjcxWk0zMy44OCwzOS4zNkEzNy43OCwzNy43OCwwLDAsMSw3MS42NSwxLjZIMjQ1LjM2VjE5OEgyMTUuMTV2NDUuMzJoMjIuNjZWMjU4LjRINzEuNjVhMzcuODUsMzcuODUsMCwwLDEtMzcuNzYtMzcuNzZaJz48L3BhdGg+XG4gICAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICAgICAgQ291cnNlc1xuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J3NpZGVfbmF2aWdhdGlvbl9pdGVtJz5cbiAgICAgICAgICAgICAgICA8c3ZnIGZpbGw9J3doaXRlJyBoZWlnaHQ9JzI0cHgnIHZpZXdCb3g9JzAgMCAxOTIwIDE5MjAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zycgc3R5bGU9e3sgbWFyZ2luQm90dG9tOiBcIjRweFwiIH19PlxuICAgICAgICAgICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgICAgICAgICAgZD0nbTE3MzkuMzQgMTI5My40MTQtMTA1LjgyNyAxODAuODE4LTI0MC4yMjUtODAuMTg4LTI0LjUwOSAyMi4yNWMtNjkuOTEgNjMuNTg2LTE1MC4yMTEgMTA5LjY2Ni0yMzguNjQ0IDEzNi43NzFsLTMyLjA3NiA5Ljk0LTQ5LjQ2OCAyNDQuMDY1SDgzNS41ODRsLTQ5LjQ2OC0yNDQuMTc5LTMyLjA3Ni05LjkzOWMtODguNDMyLTI3LjEwNS0xNjguNzM0LTczLjE4NS0yMzguNjQ0LTEzNi43NzFsLTI0LjUwOC0yMi4yNS0yNDAuMjI2IDgwLjE4OS0xMDUuODI2LTE4MC44MiAxODkuNzQtMTY0LjQ0Mi03LjQ1My0zMi45NzhjLTEwLjM5LTQ1Ljc0Mi0xNS41ODYtOTEuNDgzLTE1LjU4Ni0xMzUuODY5IDAtNDQuMzg2IDUuMTk1LTkwLjEyNyAxNS41ODYtMTM1Ljg2OGw3LjQ1NC0zMi45NzktMTg5Ljc0MS0xNjQuNDQyIDEwNS44MjYtMTgwLjgxOSAyNDAuMjI2IDgwLjA3NSAyNC41MDgtMjIuMjVjNjkuOTEtNjMuNTg1IDE1MC4yMTItMTA5LjY2NSAyMzguNjQ0LTEzNi44ODRsMzIuMDc2LTkuODI2IDQ5LjQ2OC0yNDQuMDY2aDIxMy4wMDdsNDkuNDY4IDI0NC4xOCAzMi4wNzYgOS44MjVjODguNDMzIDI3LjIxOSAxNjguNzM0IDczLjE4NiAyMzguNjQ0IDEzNi44ODVsMjQuNTA5IDIyLjI1IDI0MC4yMjUtODAuMTg5IDEwNS44MjYgMTgwLjgxOS0xODkuNzQgMTY0LjQ0MiA3LjQ1MyAzMi45OGMxMC4zOSA0NS43NCAxNS41ODYgOTEuNDgxIDE1LjU4NiAxMzUuODY3IDAgNDQuMzg2LTUuMTk1IDkwLjEyNy0xNS41ODYgMTM1Ljg2OWwtNy40NTQgMzIuOTc4IDE4OS43NDEgMTY0LjU1NlptLTUzLjc2LTMzMy40MDNjMC00MS43ODgtMy44NC04NC40OC0xMS42MzQtMTI3LjI4NGwyMTAuMTg0LTE4Mi4wNjItMTk5LjQ1NC0zNDAuODU2LTI2NS4xODYgODguNDMzYy02Ni45NzQtNTUuNTY3LTE0My4zMjItOTkuMzg4LTIyMy44NS0xMjguNDE0TDExNDAuOTc3LjAxSDc0My4xOThsLTU0LjY2MyAyNjkuNzA0Yy04MS40MzEgMjkuMTM5LTE1Ni40MjQgNzIuMjgyLTIyMy45NjMgMTI4LjQxNEwxOTkuNSAzMDkuODA5LjA0NSA2NTAuNjY1bDIxMC4wNyAxODIuMDYyYy03LjY4IDQyLjgwNC0xMS41MiA4NS40OTYtMTEuNTIgMTI3LjI4NCAwIDQxLjc4OSAzLjg0IDg0LjQ4IDExLjUyIDEyNy4xNzJMLjA0NiAxMjY5LjM1NyAxOTkuNSAxNjEwLjIxNGwyNjUuMTg2LTg4LjU0NmM2Ni45NzQgNTUuNjggMTQzLjMyMyA5OS4zODggMjIzLjg1IDEyOC41MjdsNTQuNjYzIDI2OS44MTZoMzk3Ljc3OWw1NC42NjMtMjY5LjcwM2M4MS4zMTgtMjkuMjUyIDE1Ni40MjQtNzIuMjgzIDIyMy44NS0xMjguNTI3bDI2NS4xODYgODguNTQ2IDE5OS40NTQtMzQwLjg1Ny0yMTAuMTg0LTE4Mi4xNzRjNy43OTMtNDIuODA1IDExLjYzMy04NS40OTYgMTEuNjMzLTEyNy4yODVaTTk0Mi4wNzUgNTY0LjcwNkM3MjQuMSA1NjQuNzA2IDU0Ni43ODIgNzQyLjAyNCA1NDYuNzgyIDk2MGMwIDIxNy45NzYgMTc3LjMxOCAzOTUuMjk0IDM5NS4yOTQgMzk1LjI5NCAyMTcuOTc3IDAgMzk1LjI5NC0xNzcuMzE4IDM5NS4yOTQtMzk1LjI5NCAwLTIxNy45NzYtMTc3LjMxNy0zOTUuMjk0LTM5NS4yOTQtMzk1LjI5NG0wIDY3Ny42NDdjLTE1NS42MzMgMC0yODIuMzUzLTEyNi43Mi0yODIuMzUzLTI4Mi4zNTNzMTI2LjcyLTI4Mi4zNTMgMjgyLjM1My0yODIuMzUzUzEyMjQuNDMgODA0LjM2NyAxMjI0LjQzIDk2MHMtMTI2LjcyIDI4Mi4zNTMtMjgyLjM1MyAyODIuMzUzJ1xuICAgICAgICAgICAgICAgICAgICBmaWxsUnVsZT0nZXZlbm9kZCdcbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICAgICAgU2V0dGluZ3NcbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSdzaWRlX25hdmlnYXRpb25faXRlbScgb25DbGljaz17KCkgPT4gY2xlYXJDb3Vyc2VEYXRhKCl9PlxuICAgICAgICAgICAgICAgIDxzdmcgZmlsbD0nd2hpdGUnIGhlaWdodD0nMjRweCcgdmlld0JveD0nMCAwIDE5MjAgMTkyMCcgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJyBzdHlsZT17eyBtYXJnaW5Cb3R0b206IFwiNHB4XCIgfX0+XG4gICAgICAgICAgICAgICAgICA8cGF0aFxuICAgICAgICAgICAgICAgICAgICBkPSdNOTYwIDB2MTEyLjk0MWM0NjcuMTI1IDAgODQ3LjA1OSAzNzkuOTM0IDg0Ny4wNTkgODQ3LjA1OSAwIDQ2Ny4xMjUtMzc5LjkzNCA4NDcuMDU5LTg0Ny4wNTkgODQ3LjA1OS00NjcuMTI1IDAtODQ3LjA1OS0zNzkuOTM0LTg0Ny4wNTktODQ3LjA1OSAwLTI2Ny4xMDYgMTI2LjYwNy01MTUuOTE1IDMzOC44MjQtNjc1LjcyN3YzOTMuMzc0aDExMi45NFYxMTIuOTQxSDB2MTEyLjk0MWgzNDIuODlDMTI3LjA1OCA0MDcuMzggMCA2NzQuNzExIDAgOTYwYzAgNTI5LjM1NSA0MzAuNjQ1IDk2MCA5NjAgOTYwczk2MC00MzAuNjQ1IDk2MC05NjBTMTQ4OS4zNTUgMCA5NjAgMCdcbiAgICAgICAgICAgICAgICAgICAgZmlsbFJ1bGU9J2V2ZW5vZGQnXG4gICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgICAgICAgIFJlc2V0XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9uYXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0nbmF2X3NwYWNlcicgc3R5bGU9e3sgbWluV2lkdGg6IFwiODVweFwiIH19PjwvZGl2PlxuICAgICAgICAgICAgPGRpdiBpZD0nbWFpbi1jb250ZW50JyBzdHlsZT17eyBhbGlnbkl0ZW1zOiAhY291cnNlRGF0YSA/IFwiY2VudGVyXCIgOiBcImluaGVyaXRcIiB9fT5cbiAgICAgICAgICAgICAge2NvdXJzZURhdGEgIT09IG51bGwgPyA8TWFpbkNvbnRlbnQgLz4gOiA8Q291cnNlUGlja2VyIC8+fVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC8+XG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIC8vIE91dGVyIHByb3ZpZGVyIHdyYXBwZXJcbiAgICAgIGZ1bmN0aW9uIE9mZmxpbmVBcHAoKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPENvdXJzZUNvbnRleHRQcm92aWRlcj5cbiAgICAgICAgICAgIDxOYXZpZ2F0aW9uUHJvdmlkZXI+XG4gICAgICAgICAgICAgIDxBcHBDb250ZW50IC8+XG4gICAgICAgICAgICA8L05hdmlnYXRpb25Qcm92aWRlcj5cbiAgICAgICAgICA8L0NvdXJzZUNvbnRleHRQcm92aWRlcj5cbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJyb290XCIpO1xuICAgICAgY29uc3Qgcm9vdCA9IFJlYWN0RE9NLmNyZWF0ZVJvb3QoY29udGFpbmVyKTtcbiAgICAgIHJvb3QucmVuZGVyKDxPZmZsaW5lQXBwIC8+KTsiLCIvKipcbiAqIFJlbmRlcnMgdGhlIHBlciBhc3NpZ25tZW50IGRldGFpbHMsIGFsbG93aW5nIHVzZXJzIHRvIHNlZSB0aGUgZGVzY3JpcHRpb24gYW5kIHRoZWlyIHN1Ym1pc3Npb24uXG4gKiBAcGFyYW0ge09iamVjdH0gYXNzaWdubWVudCAtIFRoZSBhc3NpZ25tZW50IHRvIHJlbmRlci5cbiAqIEByZXR1cm5zIHtKU1guRWxlbWVudHxudWxsfSBUaGUgYXNzaWdubWVudCBkZXRhaWwgdmlldy5cbiAqL1xuZnVuY3Rpb24gQXNzaWdubWVudERldGFpbFZpZXcoeyBhc3NpZ25tZW50IH0pIHtcbiAgaWYgKCFhc3NpZ25tZW50KSB7XG4gICAgcmV0dXJuIDxoMT5ObyBBc3NpZ25tZW50IFNlbGVjdGVkPC9oMT47XG4gIH1cbiAgLy8gZGF0ZSBtdXN0IGJlIGluIGZvcm1hdCBTYXQgSnVuIDMsIDIwMjMgMTI6NTBwbVxuICAvLyBhc3NpZ25tZW50Py5kdWVfYXQgaXMgaW4gZm9ybWF0IDIwMjMtMDYtMDNUMTk6NTA6MTUtMDQ6MDBcbiAgZnVuY3Rpb24gY3VzdG9tRGF0ZUZvcm1hdChkYXRlKSB7XG4gICAgY29uc3QgZGF0ZU9iaiA9IG5ldyBEYXRlKGRhdGUpO1xuICAgIGNvbnN0IGRheU9mV2VlayA9IGRhdGVPYmoudG9Mb2NhbGVEYXRlU3RyaW5nKFwiZW4tVVNcIiwge1xuICAgICAgd2Vla2RheTogXCJzaG9ydFwiLFxuICAgIH0pO1xuICAgIGNvbnN0IG1vbnRoID0gZGF0ZU9iai50b0xvY2FsZURhdGVTdHJpbmcoXCJlbi1VU1wiLCB7IG1vbnRoOiBcInNob3J0XCIgfSk7XG4gICAgY29uc3QgZGF5ID0gZGF0ZU9iai50b0xvY2FsZURhdGVTdHJpbmcoXCJlbi1VU1wiLCB7IGRheTogXCJudW1lcmljXCIgfSk7XG4gICAgY29uc3QgeWVhciA9IGRhdGVPYmoudG9Mb2NhbGVEYXRlU3RyaW5nKFwiZW4tVVNcIiwgeyB5ZWFyOiBcIm51bWVyaWNcIiB9KTtcbiAgICBjb25zdCB0aW1lID0gZGF0ZU9iai50b0xvY2FsZVRpbWVTdHJpbmcoXCJlbi1VU1wiLCB7XG4gICAgICBob3VyOiBcIm51bWVyaWNcIixcbiAgICAgIG1pbnV0ZTogXCJudW1lcmljXCIsXG4gICAgfSk7XG4gICAgcmV0dXJuIGAke2RheU9mV2Vla30gJHttb250aH0gJHtkYXl9LCAke3llYXJ9ICR7dGltZX1gO1xuICB9XG4gIGZ1bmN0aW9uIHBvaW50c0Rpc3BsYXkoYXNzaWdubWVudCkge1xuICAgIGlmIChhc3NpZ25tZW50Py5ncmFkaW5nX3R5cGUgPT0gXCJwb2ludHNcIikge1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgPD5cbiAgICAgICAgICA8c3Ryb25nPlxuICAgICAgICAgICAge2Fzc2lnbm1lbnQ/LnN1Ym1pc3Npb24/LnNjb3JlIHx8IChhc3NpZ25tZW50Py5zdWJtaXNzaW9uPy5taXNzaW5nID8gXCIwXCIgOiBcIi1cIil9L3thc3NpZ25tZW50Py5wb2ludHNfcG9zc2libGV9XG4gICAgICAgICAgPC9zdHJvbmc+XG4gICAgICAgICAge1wiIFBvaW50c1wifVxuICAgICAgICA8Lz5cbiAgICAgICk7XG4gICAgfVxuICAgIGlmIChhc3NpZ25tZW50Py5ncmFkaW5nX3R5cGUgPT0gXCJub3RfZ3JhZGVkXCIpIHtcbiAgICAgIHJldHVybiA8PjwvPjtcbiAgICB9XG4gICAgaWYgKGFzc2lnbm1lbnQ/LmdyYWRpbmdfdHlwZSA9PSBcInBhc3NfZmFpbFwiKSB7XG4gICAgICByZXR1cm4gPD57YXNzaWdubWVudD8uc3VibWlzc2lvbj8uZ3JhZGUgPT0gXCJjb21wbGV0ZVwiID8gXCJDb21wbGV0ZVwiIDogXCJJbmNvbXBsZXRlXCJ9PC8+O1xuICAgIH1cbiAgICByZXR1cm4gPD5lcnJvcjwvPjtcbiAgfVxuXG4gIHJldHVybiAoXG4gICAgPGRpdlxuICAgICAgc3R5bGU9e3tcbiAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsXG4gICAgICAgIGZsZXhEaXJlY3Rpb246IFwiY29sdW1uXCIsXG4gICAgICAgIHdpZHRoOiBcIjEwMCVcIixcbiAgICAgICAgbWFyZ2luQm90dG9tOiBcIjhlbVwiLFxuICAgICAgfX1cbiAgICA+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT0nYXNzaWdubWVudC1zdHVkZW50LWhlYWRlcic+XG4gICAgICAgIDxzcGFuIHN0eWxlPXt7IGRpc3BsYXk6IFwiZmxleFwiLCBmbGV4RGlyZWN0aW9uOiBcImNvbHVtblwiIH19PlxuICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT0nYXNzaWdubWVudC1zdHVkZW50LWhlYWRlci10aXRsZSc+e2Fzc2lnbm1lbnQ/Lm5hbWV9PC9zcGFuPlxuICAgICAgICAgIDxzcGFuIHN0eWxlPXt7IGZvbnRTaXplOiBcIjE0cHhcIiwgZm9udFdlaWdodDogXCJib2xkXCIgfX0+XG4gICAgICAgICAgICBEdWU6IHthc3NpZ25tZW50Py5kdWVfYXQgPyBjdXN0b21EYXRlRm9ybWF0KGFzc2lnbm1lbnQ/LmR1ZV9hdCkgOiBcIk5vdCBTZXRcIn1cbiAgICAgICAgICA8L3NwYW4+XG4gICAgICAgIDwvc3Bhbj5cbiAgICAgICAgPHNwYW5cbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsXG4gICAgICAgICAgICBmbGV4RGlyZWN0aW9uOiBcInJvd1wiLFxuICAgICAgICAgICAgYWxpZ25JdGVtczogXCJjZW50ZXJcIixcbiAgICAgICAgICAgIGdhcDogXCIwLjVlbVwiLFxuICAgICAgICAgIH19XG4gICAgICAgID5cbiAgICAgICAgICA8c3Bhbj5cbiAgICAgICAgICAgIHthc3NpZ25tZW50LnN1Ym1pc3Npb24/LmxhdGUgJiYgIWFzc2lnbm1lbnQuc3VibWlzc2lvbj8ubWlzc2luZyAmJiA8Q29udGV4dFBpbGwgdHlwZT0nbGF0ZScgLz59XG4gICAgICAgICAgICB7YXNzaWdubWVudC5zdWJtaXNzaW9uPy5taXNzaW5nICYmIDxDb250ZXh0UGlsbCB0eXBlPSdtaXNzaW5nJyAvPn1cbiAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgPHNwYW5cbiAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgIGZvbnRTaXplOiBcIjEuNWVtXCIsXG4gICAgICAgICAgICAgIHRleHRBbGlnbjogXCJyaWdodFwiLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICB7cG9pbnRzRGlzcGxheShhc3NpZ25tZW50KX1cbiAgICAgICAgICA8L3NwYW4+XG4gICAgICAgIDwvc3Bhbj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdlxuICAgICAgICBjbGFzc05hbWU9J2Fzc2lnbm1lbnQtaW5mb3JtYXRpb24nXG4gICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsXG4gICAgICAgICAgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIixcbiAgICAgICAgICBhbGlnbkl0ZW1zOiBcImxlZnRcIixcbiAgICAgICAgICBwYWRkaW5nOiBcIjFlbVwiLFxuICAgICAgICB9fVxuICAgICAgPlxuICAgICAgICB7dHlwZW9mIGFzc2lnbm1lbnQ/LmxvY2tfZXhwbGFuYXRpb24gPT09IFwic3RyaW5nXCIgJiYgPHNwYW4+e2Fzc2lnbm1lbnQubG9ja19leHBsYW5hdGlvbn08L3NwYW4+fVxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT0nYXNzaWdubWVudC1kZXRhaWxzJyBkYW5nZXJvdXNseVNldElubmVySFRNTD17eyBfX2h0bWw6IGFzc2lnbm1lbnQ/LmRlc2NyaXB0aW9uIH19IC8+XG4gICAgICA8QXNzaWdubWVudFJ1YnJpYyBydWJyaWM9e2Fzc2lnbm1lbnQ/LnJ1YnJpY30gLz5cbiAgICAgIHthc3NpZ25tZW50Py5zdWJtaXNzaW9uPy5hdHRhY2htZW50cyAmJiA8Q2FudmFzU3VibWlzc2lvbiBhc3NpZ25tZW50PXthc3NpZ25tZW50fSAvPn1cbiAgICAgIHsvKjxzcGFuPkRlYnVnOiB7YXNzaWdubWVudD8uaWR9PC9zcGFuPiovfVxuICAgIDwvZGl2PlxuICApO1xufVxuIiwiLyoqXG4gKiBNYWluIGZ1bmN0aW9uIHRoYXQgcmVuZGVycyB0aGUgYXNzaWdubWVudHMgcGFnZS5cbiAqIEByZXR1cm5zIFRoZSBtYWluIEFzc2lnbm1lbnRzIHBhZ2UgY29tcG9uZW50IGZvciB0aGUgdmlld2VyLlxuICovXG5cbmZ1bmN0aW9uIEFzc2lnbm1lbnRzUGFnZSgpIHtcbiAgY29uc3QgeyBjb3Vyc2VEYXRhIH0gPSB1c2VDb3Vyc2VDb250ZXh0KCk7XG4gIGlmICghY291cnNlRGF0YSkge1xuICAgIHJldHVybiA8ZGl2PkxvYWRpbmcuLi48L2Rpdj47XG4gIH1cbiAgaWYgKCFjb3Vyc2VEYXRhLkFzc2lnbm1lbnRzKSB7XG4gICAgcmV0dXJuIDxkaXY+Tm8gYXNzaWdubWVudHMgYXZhaWxhYmxlLjwvZGl2PjtcbiAgfVxuICAvLyBDb252ZXJ0IGRpY3Rpb25hcnkgb2JqZWN0IG9yIGFycmF5IGludG8gYSBmbGF0IGFycmF5IG9mIGFzc2lnbm1lbnRzXG4gIGNvbnN0IGFzc2lnbm1lbnRMaXN0ID0gQXJyYXkuaXNBcnJheShjb3Vyc2VEYXRhLkFzc2lnbm1lbnRzKSA/IGNvdXJzZURhdGEuQXNzaWdubWVudHMgOiBPYmplY3QudmFsdWVzKGNvdXJzZURhdGEuQXNzaWdubWVudHMpO1xuICAvLyBzb3J0IGFzc2lnbm1lbnRzIGJ5IHJldmVyc2UgZHVlIGRhdGUgb3JkZXJcbiAgYXNzaWdubWVudExpc3Quc29ydCgoYSwgYikgPT4ge1xuICAgIHJldHVybiBuZXcgRGF0ZShiLmR1ZV9hdCkgLSBuZXcgRGF0ZShhLmR1ZV9hdCk7XG4gIH0pO1xuICBpZiAoY291cnNlRGF0YS5Bc3NpZ25tZW50cykge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzTmFtZT0ncGFnZS1kaXYnIHN0eWxlPXt7IG1hcmdpbkJvdHRvbTogXCI0ZW1cIiB9fT5cbiAgICAgICAgPGgxIHN0eWxlPXt7IGNvbG9yOiBcIiM2NjY2NjZcIiwgZm9udFNpemU6IDI4LjggfX0+QXNzaWdubWVudHM8L2gxPlxuICAgICAgICA8Q29sbGFwc2VUYWJsZSB0aXRsZT0nQXNzaWdubWVudHMnPlxuICAgICAgICAgIHthc3NpZ25tZW50TGlzdC5tYXAoKGFzc2lnbm1lbnQsIGluZGV4KSA9PiAoXG4gICAgICAgICAgICA8Q29sbGFwc2VMaXN0SXRlbURldGFpbHNcbiAgICAgICAgICAgICAga2V5PXthc3NpZ25tZW50LmlkfVxuICAgICAgICAgICAgICBjbG9zZWQ9e2Fzc2lnbm1lbnQ/LmF2YWlsYWJpbGl0eV9zdGF0dXM/LnN0YXR1cyB8fCBcIlVua25vd25cIn0gLy8gVXNlcyAnYXZhaWxhYmlsaXR5X3N0YXR1cy5zdGF0dXMnIGZyb20gQ2FudmFzIEpTT05cbiAgICAgICAgICAgICAgdGl0bGU9e2Fzc2lnbm1lbnQ/Lm5hbWUgfHwgXCJObyBUaXRsZVwifSAvLyBVc2VzICduYW1lJyBmcm9tIENhbnZhcyBKU09OXG4gICAgICAgICAgICAgIGR1ZURhdGU9e2Fzc2lnbm1lbnQ/LmR1ZV9hdCA/IGZpeERhdGVGb3JtYXQoYXNzaWdubWVudD8uZHVlX2F0KSA6IFwiTm8gRHVlIERhdGVcIn1cbiAgICAgICAgICAgICAgZ3JhZGU9e2Fzc2lnbm1lbnQ/LnN1Ym1pc3Npb24/LnNjb3JlIHx8IFwiLVwifVxuICAgICAgICAgICAgICBtYXhHcmFkZT17YXNzaWdubWVudD8ucG9pbnRzX3Bvc3NpYmxlfSAvLyBVc2VzICdwb2ludHNfcG9zc2libGUnIGZyb20gQ2FudmFzIEpTT05cbiAgICAgICAgICAgICAgYXNzaWdubWVudD17YXNzaWdubWVudH1cbiAgICAgICAgICAgICAgdHlwZT17XCJhc3NpZ25tZW50XCJ9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgICkpfVxuICAgICAgICA8L0NvbGxhcHNlVGFibGU+XG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG59XG4iLCIvKipcbiAqIERpc3BsYXlzIGEgdGhyZWFkZGVkIHZpZXcgb2YgdGhlIGN1cnJlbnRseSBzZWxlY3RlZCBkaXNjdXNzaW9uXG4gKiBAcGFyYW0ge251bWJlcn0gZGlzY3Vzc2lvbklkIC0gVGhlIElEIG9mIHRoZSBkaXNjdXNzaW9uIHRvIGRpc3BsYXkuXG4gKiBAcmV0dXJucyBBIFJlYWN0IGNvbXBvbmVudCB0aGF0IGRpc3BsYXlzIGEgdGhyZWFkZGVkIHZpZXcgb2YgdGhlIGN1cnJlbnRseSBzZWxlY3RlZCBkaXNjdXNzaW9uLlxuICovXG5mdW5jdGlvbiBEaXNjdXNzaW9uRGV0YWlsVmlldyh7IGRpc2N1c3Npb25JZCB9KSB7XG4gIGNvbnN0IHsgY291cnNlRGF0YSB9ID0gdXNlQ291cnNlQ29udGV4dCgpO1xuICBpZiAoIWNvdXJzZURhdGEpIHtcbiAgICByZXR1cm4gPGRpdj5Mb2FkaW5nLi4uPC9kaXY+O1xuICB9XG4gIGlmICghY291cnNlRGF0YS5EaXNjdXNzaW9ucykge1xuICAgIHJldHVybiA8ZGl2Pk5vIGRpc2N1c3Npb25zIGF2YWlsYWJsZS48L2Rpdj47XG4gIH1cbiAgY29uc3QgZGlzY3Vzc2lvbiA9IGNvdXJzZURhdGEuRGlzY3Vzc2lvbnNbZGlzY3Vzc2lvbklkXTtcblxuICBmdW5jdGlvbiByZW5kZXJEaXNjdXNzaW9uQm9keSgpIHtcbiAgICBjb25zdCB2aWV3ID0gZGlzY3Vzc2lvbj8udmlldz8udmlldzsgLy8gTGlzdCBvZiBhbGwgcmVwbGllc1xuICAgIGNvbnN0IHBhcnRpY2lwYW50cyA9IGRpc2N1c3Npb24/LnZpZXc/LnBhcnRpY2lwYW50czsgLy8gTGlzdCBvZiBhbGwgcGFydGljaXBhbnRzXG4gICAgaWYgKCF2aWV3KSB7XG4gICAgICByZXR1cm4gPGRpdj5ObyBkaXNjdXNzaW9uIGJvZHkgYXZhaWxhYmxlLjwvZGl2PjtcbiAgICB9XG4gICAgaWYgKCFwYXJ0aWNpcGFudHMpIHtcbiAgICAgIHJldHVybiA8ZGl2Pk5vIHBhcnRpY2lwYW50cyBhdmFpbGFibGUuPC9kaXY+O1xuICAgIH1cbiAgICByZXR1cm4gdmlldy5tYXAoKHJlcGx5KSA9PiB7XG4gICAgICBjb25zdCBbcmVwbGllc0hpZGRlbiwgc2V0SGlkZGVuXSA9IHVzZVN0YXRlKHRydWUpO1xuICAgICAgaWYgKHJlcGx5Py5kZWxldGVkKSB7XG4gICAgICAgIHJldHVybiBcIlwiO1xuICAgICAgfVxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPGRpdlxuICAgICAgICAgIGtleT17cmVwbHkuaWR9XG4gICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgcmdiKDIzNSwgMjM2LCAyMzcpXCIsXG4gICAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiNHB4XCIsXG4gICAgICAgICAgICBwYWRkaW5nOiBcIjFlbVwiLFxuICAgICAgICAgICAgbWFyZ2luVG9wOiBcIjFlbVwiLFxuICAgICAgICAgICAgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIixcbiAgICAgICAgICB9fVxuICAgICAgICA+XG4gICAgICAgICAgPE5hbWVQcm9maWxlQ2FyZFxuICAgICAgICAgICAgbmFtZT17cGFydGljaXBhbnRzLmZpbmQoKHBhcnRpY2lwYW50KSA9PiBwYXJ0aWNpcGFudC5pZCA9PT0gcmVwbHk/LnVzZXJfaWQpPy5kaXNwbGF5X25hbWUgfHwgXCJVbmtub3duXCJ9XG4gICAgICAgICAgICBkYXRlPXtyZXBseS5jcmVhdGVkX2F0fVxuICAgICAgICAgIC8+XG4gICAgICAgICAgPGRpdlxuICAgICAgICAgICAgY2xhc3NOYW1lPSdkaXNjdXNzaW9uLWRlc2NyaXB0aW9uJ1xuICAgICAgICAgICAgc3R5bGU9e3sgbWFyZ2luQm90dG9tOiBcIjBlbVwiLCBtYXhXaWR0aDogXCIxMDAlXCIgfX1cbiAgICAgICAgICAgIGRhbmdlcm91c2x5U2V0SW5uZXJIVE1MPXt7IF9faHRtbDogcmVwbHk/Lm1lc3NhZ2UgfX1cbiAgICAgICAgICA+PC9kaXY+XG4gICAgICAgICAge3JlcGx5Py5yZXBsaWVzICYmIHJlcGx5Py5yZXBsaWVzPy5sZW5ndGggPiAwICYmIChcbiAgICAgICAgICAgIDxhXG4gICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcbiAgICAgICAgICAgICAgICBzZXRIaWRkZW4oIXJlcGxpZXNIaWRkZW4pO1xuICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICBjbGFzc05hbWU9J2Fzc2lnbm1lbnQtbGluaydcbiAgICAgICAgICAgICAgc3R5bGU9e3sgZGlzcGxheTogXCJmbGV4XCIsIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsIGdhcDogXCI1cHhcIiB9fVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICB7cmVwbGllc0hpZGRlbiA/IFwiU2hvdyBSZXBsaWVzIFwiIDogXCJIaWRlIFJlcGxpZXNcIn1cbiAgICAgICAgICAgICAgPHN2Z1xuICAgICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgICBoZWlnaHQ6IFwiMTVweFwiLFxuICAgICAgICAgICAgICAgICAgd2lkdGg6IFwiMTVweFwiLFxuICAgICAgICAgICAgICAgICAgZmlsbDogXCJyZ2IoMTQsIDEwNCwgMTc5KVwiLFxuICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtOiByZXBsaWVzSGlkZGVuID8gXCJyb3RhdGUoMGRlZylcIiA6IFwicm90YXRlKDkwZGVnKVwiLFxuICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgdmlld0JveD0nMCAwIDE5MjAgMTkyMCdcbiAgICAgICAgICAgICAgICB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnXG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8cGF0aCBkPSdNNTI2LjI5OSAwIDQzNCA5Mi4xNjhsODY3LjYzNiA4NjcuNzY3TDQzNCAxODI3LjU3bDkyLjI5OSA5Mi40MyA5NTkuOTM1LTk2MC4wNjV6JyBmaWxsPSdjdXJyZW50Q29sb3InIC8+XG4gICAgICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgICAgPC9hPlxuICAgICAgICAgICl9XG4gICAgICAgICAgeyFyZXBsaWVzSGlkZGVuICYmXG4gICAgICAgICAgICByZXBseT8ucmVwbGllcz8ubWFwKChyZXBseSkgPT4ge1xuICAgICAgICAgICAgICBpZiAocmVwbHk/LmRlbGV0ZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJcIjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgIGtleT17cmVwbHkuaWR9XG4gICAgICAgICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICAgICAgICBib3JkZXI6IFwiMXB4IHNvbGlkIHJnYigyMzUsIDIzNiwgMjM3KVwiLFxuICAgICAgICAgICAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiNHB4XCIsXG4gICAgICAgICAgICAgICAgICAgIHBhZGRpbmc6IFwiMWVtXCIsXG4gICAgICAgICAgICAgICAgICAgIG1hcmdpblRvcDogXCIxZW1cIixcbiAgICAgICAgICAgICAgICAgICAgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIixcbiAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgPE5hbWVQcm9maWxlQ2FyZFxuICAgICAgICAgICAgICAgICAgICBuYW1lPXtwYXJ0aWNpcGFudHMuZmluZCgocGFydGljaXBhbnQpID0+IHBhcnRpY2lwYW50LmlkID09PSByZXBseT8udXNlcl9pZCk/LmRpc3BsYXlfbmFtZSB8fCBcIlVua25vd25cIn1cbiAgICAgICAgICAgICAgICAgICAgZGF0ZT17cmVwbHkuY3JlYXRlZF9hdH1cbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT0nZGlzY3Vzc2lvbi1kZXNjcmlwdGlvbidcbiAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3sgbWFyZ2luQm90dG9tOiBcIjBlbVwiLCBtYXhXaWR0aDogXCIxMDAlXCIgfX1cbiAgICAgICAgICAgICAgICAgICAgZGFuZ2Vyb3VzbHlTZXRJbm5lckhUTUw9e3sgX19odG1sOiByZXBseT8ubWVzc2FnZSB9fVxuICAgICAgICAgICAgICAgICAgPjwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSl9XG4gICAgICAgIDwvZGl2PlxuICAgICAgKTtcbiAgICB9KTtcbiAgfVxuICBjb25zb2xlLmxvZyhcIlJlbmRlcmluZyBEaXNjdXNzaW9uIElEOiBcIiwgZGlzY3Vzc2lvbklkKTtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT0ncGFnZS1kaXYnIHN0eWxlPXt7IG1hcmdpbkJvdHRvbTogXCI0ZW1cIiB9fT5cbiAgICAgIDxkaXZcbiAgICAgICAgY2xhc3NOYW1lPSdkaXNjdXNzaW9uLWhlYWRlcidcbiAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICBhbGlnbkl0ZW1zOiBcImxlZnRcIixcbiAgICAgICAgICBtYXJnaW5Cb3R0b206IFwiMXJlbVwiLFxuICAgICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgcmdiKDIzNSwgMjM2LCAyMzcpXCIsXG4gICAgICAgICAgYm9yZGVyUmFkaXVzOiBcIjRweFwiLFxuICAgICAgICAgIHBhZGRpbmc6IFwiMWVtXCIsXG4gICAgICAgICAgbWFyZ2luVG9wOiBcIjJlbVwiLFxuICAgICAgICAgIGZsZXhEaXJlY3Rpb246IFwiY29sdW1uXCIsXG4gICAgICAgIH19XG4gICAgICA+XG4gICAgICAgIDxkaXZcbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsXG4gICAgICAgICAgICBmbGV4RGlyZWN0aW9uOiBcInJvd1wiLFxuICAgICAgICAgICAganVzdGlmeUNvbnRlbnQ6IFwic3BhY2UtYmV0d2VlblwiLFxuICAgICAgICAgICAgY29sb3I6IFwicmdiKDM5LCA1MywgNjQpXCIsXG4gICAgICAgICAgICBtYXJnaW5Cb3R0b206IFwiMWVtXCIsXG4gICAgICAgICAgfX1cbiAgICAgICAgPlxuICAgICAgICAgIDxzcGFuPkR1ZSB7Zml4RGF0ZUZvcm1hdChkaXNjdXNzaW9uPy5hc3NpZ25tZW50Py5kdWVfYXQpIHx8IFwiTmV2ZXJcIn08L3NwYW4+XG4gICAgICAgICAgPHNwYW4gc3R5bGU9e3sgZm9udFNpemU6IFwiMTRweFwiIH19PntkaXNjdXNzaW9uPy5hc3NpZ25tZW50Py5wb2ludHNfcG9zc2libGUgfHwgXCIwXCJ9IFBvaW50cyBQb3NzaWJsZTwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxOYW1lUHJvZmlsZUNhcmRcbiAgICAgICAgICBuYW1lPXtkaXNjdXNzaW9uPy5hdXRob3I/LmRpc3BsYXlfbmFtZSB8fCBcIkFub25ueW1vdXNcIn1cbiAgICAgICAgICBkYXRlPXtkaXNjdXNzaW9uPy5kZWxheWVkX3Bvc3RfYXQgfHwgZGlzY3Vzc2lvbj8uY3JlYXRlZF9hdCB8fCBkaXNjdXNzaW9uPy5sYXN0X3JlcGx5X2F0IHx8IGRpc2N1c3Npb24/LnBvc3RlZF9hdH1cbiAgICAgICAgLz5cbiAgICAgICAgPGgyIHN0eWxlPXt7IGNvbG9yOiBcInJnYigzOSwgNTMsIDY0KVwiLCBmb250U2l6ZTogXCIyOC44cHhcIiwgbWFyZ2luQm90dG9tOiBcIjBlbVwiIH19PntkaXNjdXNzaW9uPy50aXRsZX08L2gyPlxuICAgICAgICA8ZGl2XG4gICAgICAgICAgY2xhc3NOYW1lPSdkaXNjdXNzaW9uLWRlc2NyaXB0aW9uJ1xuICAgICAgICAgIGRhbmdlcm91c2x5U2V0SW5uZXJIVE1MPXt7IF9faHRtbDogZGlzY3Vzc2lvbj8ubWVzc2FnZSB8fCBcIk5vIGRpc2NyaXB0aW9uIHByb3ZpZGVkLlwiIH19XG4gICAgICAgID48L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdlxuICAgICAgICBjbGFzc05hbWU9J2Rpc2N1c3Npb24tYm9keSdcbiAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICBhbGlnbkl0ZW1zOiBcImxlZnRcIixcbiAgICAgICAgICBtYXJnaW5Cb3R0b206IFwiMXJlbVwiLFxuICAgICAgICAgIHBhZGRpbmc6IFwiMWVtXCIsXG4gICAgICAgICAgbWFyZ2luVG9wOiBcIjJlbVwiLFxuICAgICAgICAgIGZsZXhEaXJlY3Rpb246IFwiY29sdW1uXCIsXG4gICAgICAgIH19XG4gICAgICA+XG4gICAgICAgIHtyZW5kZXJEaXNjdXNzaW9uQm9keSgpfVxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59XG4iLCIvKipcbiAqIENyZWF0ZXMgdGhlIGRpc2N1c3Npb25zIHBhZ2UsIHdoaWNoIGxpc3RzIGFsbCB0aGUgZGlzY3Vzc2lvbnMgaW4gYSBjb3Vyc2UuXG4gKiBAcmV0dXJucyB7UmVhY3QuQ29tcG9uZW50fSB0aGUgZGlzY3Vzc2lvbnMgcGFnZVxuICovXG5cbmZ1bmN0aW9uIERpc2N1c3Npb25zUGFnZSgpIHtcbiAgY29uc3QgeyBjb3Vyc2VEYXRhLCByZWNvbm5lY3RGb2xkZXIgfSA9IHVzZUNvdXJzZUNvbnRleHQoKTtcbiAgY29uc3QgeyBuYXZpZ2F0ZVRvRGlzY3Vzc2lvbiB9ID0gdXNlTmF2aWdhdGlvbigpO1xuICBpZiAoIWNvdXJzZURhdGEpIHtcbiAgICByZXR1cm4gPGRpdj5Mb2FkaW5nLi4uPC9kaXY+O1xuICB9XG4gIGlmICghY291cnNlRGF0YS5EaXNjdXNzaW9ucyB8fCBPYmplY3Qua2V5cyhjb3Vyc2VEYXRhPy5EaXNjdXNzaW9ucyB8fCB7fSkubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIDxkaXY+Tm8gZGlzY3Vzc2lvbnMgYXZhaWxhYmxlLjwvZGl2PjtcbiAgfVxuICAvLyBDb252ZXJ0IGRpY3Rpb25hcnkgb2JqZWN0IG9yIGFycmF5IGludG8gYSBmbGF0IGFycmF5IG9mIGFzc2lnbm1lbnRzXG4gIGNvbnN0IGRpc2N1c3Npb25MaXN0ID0gQXJyYXkuaXNBcnJheShjb3Vyc2VEYXRhLkRpc2N1c3Npb25zKSA/IGNvdXJzZURhdGEuRGlzY3Vzc2lvbnMgOiBPYmplY3QudmFsdWVzKGNvdXJzZURhdGEuRGlzY3Vzc2lvbnMpO1xuICAvLyBzb3J0IGRpc2N1c3Npb25zIGJ5IHJldmVyc2UgZHVlIGRhdGUgb3JkZXJcbiAgZGlzY3Vzc2lvbkxpc3Quc29ydCgoYSwgYikgPT4ge1xuICAgIHJldHVybiBuZXcgRGF0ZShiLmR1ZV9hdCkgLSBuZXcgRGF0ZShhLmR1ZV9hdCk7XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIERpc2N1c3Npb25UYWJsZUl0ZW1EZXRhaWxzKHsgZGlzY3Vzc2lvbiB9KSB7XG4gICAgY29uc3QgaW5kZW50ID0gMDtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdlxuICAgICAgICBjbGFzc05hbWU9J2Fzc2lnbm1lbnQtZGV0YWlscydcbiAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICBhbGlnbkl0ZW1zOiBcImNlbnRlclwiLFxuICAgICAgICAgIHBhZGRpbmdMZWZ0OiBgJHtpbmRlbnQgKiAxfWVtYCxcbiAgICAgICAgICBqdXN0aWZ5Q29udGVudDogXCJzcGFjZS1iZXR3ZWVuXCIsXG4gICAgICAgICAgd2lkdGg6IFwiMTAwJVwiLFxuICAgICAgICB9fVxuICAgICAgPlxuICAgICAgICA8ZGl2XG4gICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICAgICAgYWxpZ25JdGVtczogXCJjZW50ZXJcIixcbiAgICAgICAgICB9fVxuICAgICAgICA+XG4gICAgICAgICAgPENhbnZhc0l0ZW1JY29uIGljb25fdHlwZT17XCJkaXNjdXNzaW9uXCJ9IC8+XG4gICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgIDxoM1xuICAgICAgICAgICAgICBjbGFzc05hbWU9J2Fzc2lnbm1lbnQtaW5mby10aXRsZSdcbiAgICAgICAgICAgICAgc3R5bGU9e3sgZm9udFNpemU6IFwiMTZweFwiLCBtYXJnaW46IFwiMFwiLCBjb2xvcjogXCIjMjczNDUwXCIsIGN1cnNvcjogXCJwb2ludGVyXCIgfX1cbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4ge1xuICAgICAgICAgICAgICAgIHJlY29ubmVjdEZvbGRlcigpO1xuICAgICAgICAgICAgICAgIGlmIChkaXNjdXNzaW9uPy5pZCkge1xuICAgICAgICAgICAgICAgICAgbmF2aWdhdGVUb0Rpc2N1c3Npb24oZGlzY3Vzc2lvbi5pZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICB7ZGlzY3Vzc2lvbi50aXRsZX1cbiAgICAgICAgICAgIDwvaDM+XG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9J2Fzc2lnbm1lbnQtaW5mby1pdGVtJyBzdHlsZT17eyBjb2xvcjogXCIjNjY2NjY2XCIsIGZvbnRTaXplOiAxNCwgbWFyZ2luTGVmdDogXCIwZW1cIiB9fT5cbiAgICAgICAgICAgICAgPHN0cm9uZz5MYXN0IHBvc3QgYXQge2Rpc2N1c3Npb24/Lmxhc3RfcmVwbHlfYXQgPyBmaXhEYXRlRm9ybWF0KGRpc2N1c3Npb24/Lmxhc3RfcmVwbHlfYXQpIDogXCItXCJ9PC9zdHJvbmc+XG4gICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2XG4gICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICAgICAgYWxpZ25JdGVtczogXCJmbGV4LWVuZFwiLFxuICAgICAgICAgICAgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIixcbiAgICAgICAgICAgIG1hcmdpbkxlZnQ6IFwiMmVtXCIsXG4gICAgICAgICAgICB0ZXh0QWxpZ246IFwicmlnaHRcIixcbiAgICAgICAgICAgIGp1c3RpZnlDb250ZW50OiBcInJpZ2h0XCIsXG4gICAgICAgICAgfX1cbiAgICAgICAgPlxuICAgICAgICAgIHtkaXNjdXNzaW9uPy52aWV3ICYmIChcbiAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9Jycgc3R5bGU9e3sgZm9udFNpemU6IFwiMTZweFwiLCBmb250V2VpZ2h0OiBcIm5vcm1hbFwiLCBtYXJnaW46IFwiMFwiLCBjb2xvcjogXCIjMjczNDUwXCIsIGN1cnNvcjogXCJkZWZhdWx0XCIgfX0+XG4gICAgICAgICAgICAgIHtkaXNjdXNzaW9uPy52aWV3Py52aWV3Py5sZW5ndGggfHwgXCIwXCJ9IFJlcGxpZXNcbiAgICAgICAgICAgIDwvaDM+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7ZGlzY3Vzc2lvbj8uYXNzaWdubWVudCAmJiAoXG4gICAgICAgICAgICA8aDMgY2xhc3NOYW1lPScnIHN0eWxlPXt7IGZvbnRTaXplOiBcIjE2cHhcIiwgZm9udFdlaWdodDogXCJub3JtYWxcIiwgbWFyZ2luOiBcIjBcIiwgY29sb3I6IFwiIzI3MzQ1MFwiLCBjdXJzb3I6IFwiZGVmYXVsdFwiIH19PlxuICAgICAgICAgICAgICBEdWUge2ZpeERhdGVGb3JtYXQoZGlzY3Vzc2lvbj8uYXNzaWdubWVudD8uZHVlX2F0KX1cbiAgICAgICAgICAgIDwvaDM+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG5cbiAgaWYgKGNvdXJzZURhdGEuRGlzY3Vzc2lvbnMpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBjbGFzc05hbWU9J3BhZ2UtZGl2JyBzdHlsZT17eyBtYXJnaW5Cb3R0b206IFwiNGVtXCIgfX0+XG4gICAgICAgIDxoMSBzdHlsZT17eyBjb2xvcjogXCIjNjY2NjY2XCIsIGZvbnRTaXplOiAyOC44IH19PkRpc2N1c3Npb25zPC9oMT5cbiAgICAgICAgPENvbGxhcHNlVGFibGUgdGl0bGU9J0Rpc2N1c3Npb25zJz5cbiAgICAgICAgICB7ZGlzY3Vzc2lvbkxpc3QubWFwKChkaXNjdXNzaW9uLCBpbmRleCkgPT4gKFxuICAgICAgICAgICAgPERpc2N1c3Npb25UYWJsZUl0ZW1EZXRhaWxzIGRpc2N1c3Npb249e2Rpc2N1c3Npb259IGtleT17ZGlzY3Vzc2lvbi5pZH0gLz5cbiAgICAgICAgICApKX1cbiAgICAgICAgPC9Db2xsYXBzZVRhYmxlPlxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfVxufVxuIiwiLyoqXG4gKiBEaXNwbGF5cyB0aGUgbGlzdCBvZiBmaWxlcy4gVGhpcyBwYWdlIGhhcyB0byBoYW5kbGUgcGFyZW50IGZvbGRlcnMsIGFuZCBmaWxlcyBpbnNpZGUgdGhvc2UgcGFyZW50IGZvbGRlcnMuXG4gKiBAcmV0dXJucyB7UmVhY3QuQ29tcG9uZW50fSBUaGUgZmlsZXMgcGFnZVxuICovXG5cbmZ1bmN0aW9uIEZpbGVzUGFnZSgpIHtcbiAgY29uc3QgeyBjb3Vyc2VEYXRhLCByZWNvbm5lY3RGb2xkZXIgfSA9IHVzZUNvdXJzZUNvbnRleHQoKTtcbiAgY29uc3QgeyBuYXZpZ2F0ZVRvUGFnZSB9ID0gdXNlTmF2aWdhdGlvbigpO1xuICBjb25zdCBbc2VsZWN0ZWRGaWxlLCBzZXRTZWxlY3RlZEZpbGVdID0gdXNlU3RhdGUobnVsbCk7XG5cbiAgaWYgKCFjb3Vyc2VEYXRhKSB7XG4gICAgcmV0dXJuIDxkaXY+TG9hZGluZy4uLjwvZGl2PjtcbiAgfVxuICBpZiAoIWNvdXJzZURhdGE/LkZpbGVzIHx8IChjb3Vyc2VEYXRhPy5GaWxlcz8uZmlsZXM/Lmxlbmd0aCA9PT0gMCAmJiBjb3Vyc2VEYXRhPy5GaWxlcz8uZm9sZGVycz8ubGVuZ3RoID09PSAwKSkge1xuICAgIHJldHVybiA8ZGl2Pk5vIGZpbGVzIGF2YWlsYWJsZS48L2Rpdj47XG4gIH1cbiAgLy8gRmluZCB0aGUgSUQgb2YgdGhlIG1haW4gZm9sZGVyXG4gIGNvbnN0IHJvb3RGb2xkZXIgPSBjb3Vyc2VEYXRhLkZpbGVzLmZvbGRlcnMuZmluZCgoZm9sZGVyKSA9PiBmb2xkZXIucGFyZW50X2ZvbGRlcl9pZCA9PT0gbnVsbCk7XG5cbiAgY29uc3QgW2FjdGl2ZUZvbGRlciwgc2V0QWN0aXZlRm9sZGVyXSA9IHVzZVN0YXRlKHJvb3RGb2xkZXIgPyByb290Rm9sZGVyLmlkIDogbnVsbCk7XG5cbiAgLy8gQnVpbGQgdW5pZmllZCBsaXN0IG9mIGZpbGVzIGFuZCBmb2xkZXJzLCBzb3J0ZWQgYnkgZGlzcGxheSBuYW1lXG4gIGNvbnN0IGZpbGVzQXJyYXkgPSBBcnJheS5pc0FycmF5KGNvdXJzZURhdGEuRmlsZXMuZmlsZXMpID8gY291cnNlRGF0YS5GaWxlcy5maWxlcyA6IE9iamVjdC52YWx1ZXMoY291cnNlRGF0YS5GaWxlcy5maWxlcyk7XG4gIGNvbnN0IGZvbGRlcnNBcnJheSA9IEFycmF5LmlzQXJyYXkoY291cnNlRGF0YS5GaWxlcy5mb2xkZXJzKSA/IGNvdXJzZURhdGEuRmlsZXMuZm9sZGVycyA6IE9iamVjdC52YWx1ZXMoY291cnNlRGF0YS5GaWxlcy5mb2xkZXJzKTtcbiAgY29uc3QgY29tYmluZWRMaXN0ID0gWy4uLmZpbGVzQXJyYXksIC4uLmZvbGRlcnNBcnJheV1cbiAgICAubWFwKChpdGVtKSA9PiB7XG4gICAgICBpZiAoaXRlbS5kaXNwbGF5X25hbWUpIHtcbiAgICAgICAgcmV0dXJuIHsgLi4uaXRlbSwgX3R5cGU6IFwiZmlsZVwiIH07XG4gICAgICB9IGVsc2UgaWYgKGl0ZW0ubmFtZSkge1xuICAgICAgICByZXR1cm4geyAuLi5pdGVtLCBfdHlwZTogXCJmb2xkZXJcIiwgZGlzcGxheV9uYW1lOiBpdGVtLm5hbWUgfTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7IC4uLml0ZW0sIF90eXBlOiBcInVua25vd25cIiB9O1xuICAgIH0pXG4gICAgLnNvcnQoKGEsIGIpID0+IChhLmRpc3BsYXlfbmFtZSB8fCBcIlwiKS5sb2NhbGVDb21wYXJlKGIuZGlzcGxheV9uYW1lIHx8IFwiXCIpKTtcblxuICAvLyBGaWx0ZXIgdGhlIGNvbWJpbmVkIGxpc3QgYnkgYWN0aXZlRm9sZGVyXG4gIGNvbnN0IGZpbHRlcmVkTGlzdCA9IGNvbWJpbmVkTGlzdC5maWx0ZXIoKGl0ZW0pID0+IGl0ZW0ucGFyZW50X2ZvbGRlcl9pZCA9PT0gYWN0aXZlRm9sZGVyIHx8IGl0ZW0uZm9sZGVyX2lkID09PSBhY3RpdmVGb2xkZXIpO1xuXG4gIGlmIChzZWxlY3RlZEZpbGUpIHtcbiAgICByZXR1cm4gPEZpbGVzUGFnZURldGFpbFZpZXcgZmlsZT17c2VsZWN0ZWRGaWxlfSBvbkJhY2s9eygpID0+IHNldFNlbGVjdGVkRmlsZShudWxsKX0gLz47XG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxkaXYgc3R5bGU9e3sgd2lkdGg6IFwiMTAwJVwiLCBtYXJnaW5Cb3R0b206IFwiOGVtXCIgfX0+XG4gICAgICA8ZGl2XG4gICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsXG4gICAgICAgICAganVzdGlmeUNvbnRlbnQ6IFwic3BhY2UtYmV0d2VlblwiLFxuICAgICAgICAgIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsXG4gICAgICAgIH19XG4gICAgICA+XG4gICAgICAgIDxoMSBzdHlsZT17eyBjb2xvcjogXCIjNjY2NjY2XCIsIGZvbnRTaXplOiAyOC44IH19PkZpbGVzICZhbXA7IEZvbGRlcnM8L2gxPlxuICAgICAgICB7YWN0aXZlRm9sZGVyICE9PSByb290Rm9sZGVyPy5pZCAmJiAoXG4gICAgICAgICAgPHNwYW5cbiAgICAgICAgICAgIGNsYXNzTmFtZT0nYXNzaWdubWVudC1saW5rJ1xuICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgZm9udFdlaWdodDogXCJib2xkXCIsXG4gICAgICAgICAgICAgIGNvbG9yOiBcImJsYWNrXCIsXG4gICAgICAgICAgICAgIG1hcmdpblJpZ2h0OiBcIjJlbVwiLFxuICAgICAgICAgICAgICBib3JkZXI6IFwiMXB4IHNvbGlkIHJnYigyMzIsIDIzNCwgMjM2KVwiLFxuICAgICAgICAgICAgICBwYWRkaW5nOiBcIjAuMjVlbVwiLFxuICAgICAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiNHB4XCIsXG4gICAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogXCJyZ2IoMjQyLCAyNDQsIDI0NClcIixcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XG4gICAgICAgICAgICAgIHNldEFjdGl2ZUZvbGRlcihmb2xkZXJzQXJyYXkuZmluZCgoZm9sZGVyKSA9PiBmb2xkZXIuaWQgPT09IGFjdGl2ZUZvbGRlcik/LnBhcmVudF9mb2xkZXJfaWQgfHwgcm9vdEZvbGRlciB8fCBudWxsKTtcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgPlxuICAgICAgICAgICAgQmFja1xuICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgKX1cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzc05hbWU9J3BhZ2VzLWNvbnRhaW5lcicgc3R5bGU9e3sgd2lkdGg6IFwiMTAwJVwiIH19PlxuICAgICAgICA8dGFibGUgY2xhc3NOYW1lPSdwYWdlcy10YWJsZScgc3R5bGU9e3sgd2lkdGg6IFwiMTAwJVwiIH19PlxuICAgICAgICAgIDx0aGVhZD5cbiAgICAgICAgICAgIDx0ciBzdHlsZT17eyBib3JkZXJCb3R0b206IFwiMnB4IHNvbGlkIHJnYigzOSwgNTMsIDY0KVwiIH19PlxuICAgICAgICAgICAgICA8dGggc3R5bGU9e3sgbWluV2lkdGg6IFwiZml0LWNvbnRlbnRcIiwgd2hpdGVTcGFjZTogXCJub3dyYXBcIiB9fT5UaXRsZTwvdGg+XG4gICAgICAgICAgICAgIDx0aCBzdHlsZT17eyBtaW5XaWR0aDogXCJmaXQtY29udGVudFwiLCB3aGl0ZVNwYWNlOiBcIm5vd3JhcFwiIH19PlR5cGU8L3RoPlxuICAgICAgICAgICAgICA8dGggc3R5bGU9e3sgbWluV2lkdGg6IFwiZml0LWNvbnRlbnRcIiwgd2hpdGVTcGFjZTogXCJub3dyYXBcIiB9fT5DcmVhdGlvbiBEYXRlPC90aD5cbiAgICAgICAgICAgICAgPHRoIHN0eWxlPXt7IG1pbldpZHRoOiBcImZpdC1jb250ZW50XCIsIHdoaXRlU3BhY2U6IFwibm93cmFwXCIgfX0+VXBkYXRlZCBhdDwvdGg+XG4gICAgICAgICAgICA8L3RyPlxuICAgICAgICAgIDwvdGhlYWQ+XG4gICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAge2ZpbHRlcmVkTGlzdC5tYXAoKGl0ZW0sIGluZGV4KSA9PiAoXG4gICAgICAgICAgICAgIDx0ciBrZXk9e2l0ZW0uaWQgfHwgaW5kZXh9IHN0eWxlPXt7IGJhY2tncm91bmRDb2xvcjogaW5kZXggJSAyID09PSAwID8gXCIjZjJmNGY0XCIgOiBcIndoaXRlXCIgfX0+XG4gICAgICAgICAgICAgICAgPHRkPlxuICAgICAgICAgICAgICAgICAge2l0ZW0uX3R5cGUgPT09IFwiZm9sZGVyXCIgPyAoXG4gICAgICAgICAgICAgICAgICAgIDxhXG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPSdhc3NpZ25tZW50LWxpbmsnXG4gICAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3sgZm9udFdlaWdodDogXCJib2xkXCIsIGNvbG9yOiBcImJsYWNrXCIgfX1cbiAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVjb25uZWN0Rm9sZGVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRBY3RpdmVGb2xkZXIoaXRlbS5pZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRTZWxlY3RlZEZpbGUobnVsbCk7XG4gICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgIHtpdGVtLmRpc3BsYXlfbmFtZX1cbiAgICAgICAgICAgICAgICAgICAgPC9hPlxuICAgICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgICAgPGFcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9J2Fzc2lnbm1lbnQtbGluaydcbiAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVjb25uZWN0Rm9sZGVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRTZWxlY3RlZEZpbGUoaXRlbSk7XG4gICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgIHtpdGVtLmRpc3BsYXlfbmFtZX1cbiAgICAgICAgICAgICAgICAgICAgPC9hPlxuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgIDx0ZD57aXRlbS5fdHlwZSA9PT0gXCJmb2xkZXJcIiA/IFwiZm9sZGVyXCIgOiBpdGVtW1wiY29udGVudC10eXBlXCJdfTwvdGQ+XG4gICAgICAgICAgICAgICAgPHRkIHN0eWxlPXt7IG1pbldpZHRoOiBcImZpdC1jb250ZW50XCIsIHdoaXRlU3BhY2U6IFwibm93cmFwXCIgfX0+XG4gICAgICAgICAgICAgICAgICB7aXRlbS5jcmVhdGVkX2F0XG4gICAgICAgICAgICAgICAgICAgID8gbmV3IERhdGUoaXRlbS5jcmVhdGVkX2F0KS50b0xvY2FsZURhdGVTdHJpbmcoXCJlbi1VU1wiLCB7IHllYXI6IFwibnVtZXJpY1wiLCBtb250aDogXCJzaG9ydFwiLCBkYXk6IFwibnVtZXJpY1wiIH0pXG4gICAgICAgICAgICAgICAgICAgIDogXCItXCJ9XG4gICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICA8dGQgc3R5bGU9e3sgbWluV2lkdGg6IFwiZml0LWNvbnRlbnRcIiwgd2hpdGVTcGFjZTogXCJub3dyYXBcIiB9fT5cbiAgICAgICAgICAgICAgICAgIHtpdGVtLnVwZGF0ZWRfYXRcbiAgICAgICAgICAgICAgICAgICAgPyBuZXcgRGF0ZShpdGVtLnVwZGF0ZWRfYXQpLnRvTG9jYWxlRGF0ZVN0cmluZyhcImVuLVVTXCIsIHsgeWVhcjogXCJudW1lcmljXCIsIG1vbnRoOiBcInNob3J0XCIsIGRheTogXCJudW1lcmljXCIgfSlcbiAgICAgICAgICAgICAgICAgICAgOiBcIi1cIn1cbiAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICB7ZmlsdGVyZWRMaXN0Lmxlbmd0aCA9PT0gMCAmJiAoXG4gICAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgICA8dGQgY29sU3Bhbj17NH0+XG4gICAgICAgICAgICAgICAgICBObyBmaWxlcyBpbiB0aGlzIGZvbGRlcix7XCIgXCJ9XG4gICAgICAgICAgICAgICAgICA8YVxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9J2Fzc2lnbm1lbnQtbGluaydcbiAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT5cbiAgICAgICAgICAgICAgICAgICAgICBzZXRBY3RpdmVGb2xkZXIoZm9sZGVyc0FycmF5LmZpbmQoKGZvbGRlcikgPT4gZm9sZGVyLmlkID09PSBhY3RpdmVGb2xkZXIpPy5wYXJlbnRfZm9sZGVyX2lkIHx8IHJvb3RGb2xkZXIgfHwgbnVsbClcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICBCYWNrXG4gICAgICAgICAgICAgICAgICA8L2E+XG4gICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPC90Ym9keT5cbiAgICAgICAgPC90YWJsZT5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufVxuIiwiLyoqXG4gKiBUaGUgZGV0YWlsIHZpZXcgZm9yIGEgZmlsZS4gSXQgZGlzcGxheXMgdGhlIGZpbGUncyBpbmZvcm1hdGlvbiBhbmQgdGhlIGZpbGUgaXRzZWxmLiBVdGlsaXplcyB0aGUgTG9jYWxBdGF0Y2htZW50IFZpZXdlciB3aGljaCB3YXMgY3JlYXRlZCBmb3Igc3VibWlzc2lvbiB2aWV3aW5nLlxuICogQHBhcmFtIHsqfSBmaWxlIC0gVGhlIGZpbGUgdG8gZGlzcGxheS5cbiAqIEBwYXJhbSB7Kn0gb25CYWNrIC0gVGhlIGZ1bmN0aW9uIHRvIGNhbGwgd2hlbiB0aGUgYmFjayBidXR0b24gaXMgY2xpY2tlZC5cbiAqIEByZXR1cm5zIHtSZWFjdC5Db21wb25lbnR9IFRoZSBmaWxlcyBwYWdlIGRldGFpbCB2aWV3XG4gKi9cbmZ1bmN0aW9uIEZpbGVzUGFnZURldGFpbFZpZXcoeyBmaWxlLCBvbkJhY2sgfSkge1xuICBpZiAoIWZpbGUpIHtcbiAgICByZXR1cm4gPGgxPk5vIEZpbGUgU2VsZWN0ZWQ8L2gxPjtcbiAgfVxuXG4gIGNvbnN0IGZvcm1hdHRlZENyZWF0ZWQgPSBmaWxlLmNyZWF0ZWRfYXRcbiAgICA/IG5ldyBEYXRlKGZpbGUuY3JlYXRlZF9hdCkudG9Mb2NhbGVEYXRlU3RyaW5nKFwiZW4tVVNcIiwgeyB5ZWFyOiBcIm51bWVyaWNcIiwgbW9udGg6IFwic2hvcnRcIiwgZGF5OiBcIm51bWVyaWNcIiB9KVxuICAgIDogXCItXCI7XG4gIGNvbnN0IGZvcm1hdHRlZFVwZGF0ZWQgPSBmaWxlLnVwZGF0ZWRfYXRcbiAgICA/IG5ldyBEYXRlKGZpbGUudXBkYXRlZF9hdCkudG9Mb2NhbGVEYXRlU3RyaW5nKFwiZW4tVVNcIiwgeyB5ZWFyOiBcIm51bWVyaWNcIiwgbW9udGg6IFwic2hvcnRcIiwgZGF5OiBcIm51bWVyaWNcIiB9KVxuICAgIDogXCItXCI7XG4gIGNvbnN0IGZvcm1hdHRlZFNpemUgPSBmaWxlLnNpemUgPyAoZmlsZS5zaXplIC8gMTAyNCkudG9GaXhlZCgxKSArIFwiIEtCXCIgOiBcIi1cIjtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogXCJmbGV4XCIsIGZsZXhEaXJlY3Rpb246IFwiY29sdW1uXCIsIHdpZHRoOiBcIjEwMCVcIiwgbWFyZ2luQm90dG9tOiBcIjhlbVwiLCBtYXJnaW5Ub3A6IFwiMWVtXCIgfX0+XG4gICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6IFwiZmxleFwiLCBqdXN0aWZ5Q29udGVudDogXCJzcGFjZS1iZXR3ZWVuXCIsIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsIG1hcmdpbkJvdHRvbTogXCIxcmVtXCIgfX0+XG4gICAgICAgIDxoMiBzdHlsZT17eyBjb2xvcjogXCIjNjY2NjY2XCIsIGZvbnRTaXplOiAyNCwgbWFyZ2luOiAwIH19PntmaWxlLmRpc3BsYXlfbmFtZSB8fCBmaWxlLmZpbGVuYW1lfTwvaDI+XG4gICAgICAgIDxidXR0b25cbiAgICAgICAgICBvbkNsaWNrPXtvbkJhY2t9XG4gICAgICAgICAgc3R5bGU9e3sgYmFja2dyb3VuZDogXCIjMDA4NDJjXCIsIGNvbG9yOiBcIiNmZmZcIiwgYm9yZGVyOiBcIm5vbmVcIiwgYm9yZGVyUmFkaXVzOiBcIjRweFwiLCBwYWRkaW5nOiBcIjZweCAxMnB4XCIsIGN1cnNvcjogXCJwb2ludGVyXCIgfX1cbiAgICAgICAgPlxuICAgICAgICAgIEJhY2tcbiAgICAgICAgPC9idXR0b24+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXZcbiAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICBtYXJnaW5Cb3R0b206IFwiMS41cmVtXCIsXG4gICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcIiNmOWZhZmJcIixcbiAgICAgICAgICBwYWRkaW5nOiBcIjFyZW1cIixcbiAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiMC41cmVtXCIsXG4gICAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCAjZTVlN2ViXCIsXG4gICAgICAgIH19XG4gICAgICA+XG4gICAgICAgIDxwIHN0eWxlPXt7IG1hcmdpbjogXCIwLjI1cmVtIDBcIiB9fT5cbiAgICAgICAgICA8c3Ryb25nPlR5cGU6PC9zdHJvbmc+IHtmaWxlW1wiY29udGVudC10eXBlXCJdIHx8IGZpbGUubWltZV9jbGFzcyB8fCBcInVua25vd25cIn1cbiAgICAgICAgPC9wPlxuICAgICAgICA8cCBzdHlsZT17eyBtYXJnaW46IFwiMC4yNXJlbSAwXCIgfX0+XG4gICAgICAgICAgPHN0cm9uZz5TaXplOjwvc3Ryb25nPiB7Zm9ybWF0dGVkU2l6ZX1cbiAgICAgICAgPC9wPlxuICAgICAgICA8cCBzdHlsZT17eyBtYXJnaW46IFwiMC4yNXJlbSAwXCIgfX0+XG4gICAgICAgICAgPHN0cm9uZz5DcmVhdGVkOjwvc3Ryb25nPiB7Zm9ybWF0dGVkQ3JlYXRlZH1cbiAgICAgICAgPC9wPlxuICAgICAgICA8cCBzdHlsZT17eyBtYXJnaW46IFwiMC4yNXJlbSAwXCIgfX0+XG4gICAgICAgICAgPHN0cm9uZz5VcGRhdGVkOjwvc3Ryb25nPiB7Zm9ybWF0dGVkVXBkYXRlZH1cbiAgICAgICAgPC9wPlxuICAgICAgPC9kaXY+XG4gICAgICA8TG9jYWxBdHRhY2htZW50Vmlld2VyIGZpbGU9e2ZpbGV9IC8+XG4gICAgPC9kaXY+XG4gICk7XG59XG4iLCIvKipcbiAqIFRoZSBncmFkZXMgcGFnZSBkaXNwbGF5cyBhbGwgb2YgdGhlIGdyYWRlcyBmb3IgdGhlIGNvdXJzZS4gSXQgaW5jbHVkZXMgdGhlIGFiaWxpdHkgdG8gc29ydCBieSBkdWUgZGF0ZSwgbmFtZSxcbiAqIHN1Ym1pdHRlZCBkYXRlLCBzdGF0dXMsIGFuZCBhc3NpZ25tZW50IGdyb3VwLiBJdCBhbHNvIGluY2x1ZGVzIHRoZSBhYmlsaXR5IHRvIGZpbHRlciBieSBncmFkaW5nIHBlcmlvZCBhbmQgdG9cbiAqIGdyb3VwIGJ5IGFzc2lnbm1lbnQgZ3JvdXAuXG4gKiBAcmV0dXJucyB7UmVhY3QuQ29tcG9uZW50fSBUaGUgZ3JhZGVzIHBhZ2UuXG4gKi9cbmZ1bmN0aW9uIEdyYWRlc1BhZ2UoKSB7XG4gIGNvbnN0IHsgY291cnNlRGF0YSB9ID0gdXNlQ291cnNlQ29udGV4dCgpO1xuICBjb25zdCB7IHVzZVN0YXRlLCB1c2VNZW1vIH0gPSBSZWFjdDtcbiAgaWYgKCFjb3Vyc2VEYXRhKSB7XG4gICAgcmV0dXJuIDxkaXY+TG9hZGluZy4uLjwvZGl2PjtcbiAgfVxuICBpZiAoIWNvdXJzZURhdGEuQXNzaWdubWVudHMpIHtcbiAgICByZXR1cm4gPGRpdj5ObyBncmFkZXMgYXZhaWxhYmxlLjwvZGl2PjtcbiAgfVxuXG4gIC8vIENvbnZlcnQgZGljdGlvbmFyeSBvYmplY3Qgb3IgYXJyYXkgaW50byBhIGZsYXQgYXJyYXkgb2YgZ3JhZGVzXG4gIGxldCBncmFkZUxpc3QgPSBBcnJheS5pc0FycmF5KGNvdXJzZURhdGEuQXNzaWdubWVudHMpID8gY291cnNlRGF0YS5Bc3NpZ25tZW50cyA6IE9iamVjdC52YWx1ZXMoY291cnNlRGF0YS5Bc3NpZ25tZW50cyk7XG5cbiAgLy8gU2V0IHRoZSBkZWZhdWx0IHNvcnRpbmcgbWV0aG9kIGZvciB0aGUgZ3JhZGVzIHBhZ2VcbiAgbGV0IFtzb3J0QnksIHNldFNvcnRCeV0gPSB1c2VTdGF0ZShcImR1ZVwiKTtcbiAgLy8gU2V0IHRoZSBkZWZhdWx0IGdyYWRpbmcgcGVyaW9kIHRvIGFsbFxuICBsZXQgW3NlbGVjdGVkR3JhZGluZ1BlcmlvZCwgc2V0U2VsZWN0ZWRHcmFkaW5nUGVyaW9kXSA9IHVzZVN0YXRlKFwiYWxsXCIpO1xuICAvLyBHZXQgdGhlIGdyYWRpbmcgcGVyaW9kcyBmcm9tIHRoZSBjb3Vyc2UgZGF0YVxuICBsZXQgZ3JhZGluZ1BlcmlvZHMgPSB1bmRlZmluZWQ7XG4gIGlmIChjb3Vyc2VEYXRhPy5HcmFkaW5nUGVyaW9kcz8uZ3JhZGluZ19wZXJpb2RzKSB7XG4gICAgZ3JhZGluZ1BlcmlvZHMgPSBjb3Vyc2VEYXRhLkdyYWRpbmdQZXJpb2RzLmdyYWRpbmdfcGVyaW9kcztcbiAgfVxuICAvLyBGaWx0ZXIgb3V0IHRoZSBhc3NpZ25tZW50cyB0aGF0IHdpbGwgbm90IGJlIGdyYWRlZCBncmFkaW5nX3R5cGU6IFwibm90X2dyYWRlZFwiLFxuICAvLyBGaWx0ZXIgdGhlIGFjdGl2ZSBhc3NpZ25tZW50cyBieSB0aGVpciBncmFkaW5nX3BlcmlvZF9pZFxuICAvLyBhbmQgc29ydCBieSB0aGUgc2VsZWN0ZWQgc29ydEJ5IHZhbHVlXG4gIGdyYWRlTGlzdCA9IGdyYWRlTGlzdFxuICAgIC5maWx0ZXIoXG4gICAgICAoYXNzaWdubWVudCkgPT5cbiAgICAgICAgYXNzaWdubWVudC5ncmFkaW5nX3R5cGUgIT09IFwibm90X2dyYWRlZFwiICYmXG4gICAgICAgIChzZWxlY3RlZEdyYWRpbmdQZXJpb2QgPT09IFwiYWxsXCIgfHxcbiAgICAgICAgICAoYXNzaWdubWVudD8uc3VibWlzc2lvbj8uZ3JhZGluZ19wZXJpb2RfaWQgIT0gbnVsbCAmJlxuICAgICAgICAgICAgU3RyaW5nKGFzc2lnbm1lbnQuc3VibWlzc2lvbi5ncmFkaW5nX3BlcmlvZF9pZCkgPT09IFN0cmluZyhzZWxlY3RlZEdyYWRpbmdQZXJpb2QpKSksXG4gICAgKVxuICAgIC5zb3J0KChhLCBiKSA9PiB7XG4gICAgICBpZiAoc29ydEJ5ID09PSBcImR1ZVwiKSB7XG4gICAgICAgIGNvbnN0IGFEYXRlID0gYS5kdWVfYXQgPyBuZXcgRGF0ZShhLmR1ZV9hdCkgOiBuZXcgRGF0ZSgwKTtcbiAgICAgICAgY29uc3QgYkRhdGUgPSBiLmR1ZV9hdCA/IG5ldyBEYXRlKGIuZHVlX2F0KSA6IG5ldyBEYXRlKDApO1xuICAgICAgICByZXR1cm4gYURhdGUgLSBiRGF0ZTtcbiAgICAgIH0gZWxzZSBpZiAoc29ydEJ5ID09PSBcIm5hbWVcIikge1xuICAgICAgICByZXR1cm4gKGEubmFtZSB8fCBcIlwiKS5sb2NhbGVDb21wYXJlKGIubmFtZSB8fCBcIlwiKTtcbiAgICAgIH0gZWxzZSBpZiAoc29ydEJ5ID09PSBcInN1Ym1pdHRlZFwiKSB7XG4gICAgICAgIGNvbnN0IGFTdWIgPSBhLnN1Ym1pc3Npb24/LnN1Ym1pdHRlZF9hdCA/IG5ldyBEYXRlKGEuc3VibWlzc2lvbi5zdWJtaXR0ZWRfYXQpIDogbmV3IERhdGUoMCk7XG4gICAgICAgIGNvbnN0IGJTdWIgPSBiLnN1Ym1pc3Npb24/LnN1Ym1pdHRlZF9hdCA/IG5ldyBEYXRlKGIuc3VibWlzc2lvbi5zdWJtaXR0ZWRfYXQpIDogbmV3IERhdGUoMCk7XG4gICAgICAgIHJldHVybiBhU3ViIC0gYlN1YjtcbiAgICAgIH0gZWxzZSBpZiAoc29ydEJ5ID09PSBcInN0YXR1c1wiKSB7XG4gICAgICAgIHJldHVybiAoYS5zdWJtaXNzaW9uPy53b3JrZmxvd19zdGF0ZSB8fCBcIlwiKS5sb2NhbGVDb21wYXJlKGIuc3VibWlzc2lvbj8ud29ya2Zsb3dfc3RhdGUgfHwgXCJcIik7XG4gICAgICB9IGVsc2UgaWYgKHNvcnRCeSA9PT0gXCJhc3NpZ25tZW50X2dyb3VwXCIpIHtcbiAgICAgICAgcmV0dXJuIChOdW1iZXIoYS5hc3NpZ25tZW50X2dyb3VwX2lkKSB8fCAwKSAtIChOdW1iZXIoYi5hc3NpZ25tZW50X2dyb3VwX2lkKSB8fCAwKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiAwO1xuICAgIH0pO1xuXG4gIGxldCBhc3NpZ25tZW50R3JvdXBzID0gdW5kZWZpbmVkO1xuICBpZiAoY291cnNlRGF0YT8uQXNzaWdubWVudEdyb3Vwcykge1xuICAgIGFzc2lnbm1lbnRHcm91cHMgPSBjb3Vyc2VEYXRhLkFzc2lnbm1lbnRHcm91cHM7XG4gIH1cblxuICBsZXQgdXNlQXNzaWdubWVudEdyb3Vwc0ZvcldlaWdodGluZyA9IGNvdXJzZURhdGE/Lm1hbmlmZXN0Py51c2VBc3NpZ25tZW50R3JvdXBzRm9yV2VpZ2h0aW5nIHx8IGZhbHNlO1xuXG4gIC8vQXNzaWdubWVudCBkZXRhaWxzIG9wZW4vY2xvc2VkIHN0YXRlIG1hbmFnZW1lbnQuIERlZmF1bHQgdG8gYWxsIGNsb3NlZC5cbiAgY29uc3QgW29wZW5TdGF0ZXMsIHNldE9wZW5TdGF0ZXNdID0gdXNlU3RhdGUoKCkgPT4ge1xuICAgIGNvbnN0IGluaXRpYWwgPSB7fTtcbiAgICBncmFkZUxpc3QuZm9yRWFjaCgobSkgPT4ge1xuICAgICAgaW5pdGlhbFttLmlkXSA9IHRydWU7XG4gICAgfSk7XG4gICAgcmV0dXJuIGluaXRpYWw7XG4gIH0pO1xuICAvLyBEZXJpdmVkIHN0YXRlOiBJZiBBVCBMRUFTVCBPTkUgZGV0YWlsIGlzIG9wZW4sIGJ1dHRvbiBhY3Rpb24gaXMgXCJIaWRlIEFsbCBEZXRhaWxzXCIuXG4gIC8vIElmIEFMTCBtb2R1bGVzIGFyZSBjb2xsYXBzZWQgKG5vbmUgYXJlIG9wZW4pLCBidXR0b24gYWN0aW9uIGlzIFwiU2hvdyBBbGwgRGV0YWlsc1wiLlxuICBjb25zdCBpc0FueU9wZW4gPSB1c2VNZW1vKCgpID0+IHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyhvcGVuU3RhdGVzKS5zb21lKChpc09wZW4pID0+IGlzT3BlbiA9PT0gdHJ1ZSk7XG4gIH0sIFtvcGVuU3RhdGVzXSk7XG5cbiAgLy8gVG9nZ2xlIGluZGl2aWR1YWwgbW9kdWxlIGhlYWRlciBjbGlja1xuICBjb25zdCBoYW5kbGVUb2dnbGVNb2R1bGUgPSAoaWQpID0+IHtcbiAgICBzZXRPcGVuU3RhdGVzKChwcmV2KSA9PiAoe1xuICAgICAgLi4ucHJldixcbiAgICAgIFtpZF06ICFwcmV2W2lkXSxcbiAgICB9KSk7XG4gIH07XG5cbiAgLy8gTWFzdGVyIGJ1dHRvbiB0b2dnbGUgaGFuZGxlclxuICBjb25zdCBoYW5kbGVNYXN0ZXJUb2dnbGUgPSAoKSA9PiB7XG4gICAgY29uc3QgbmV4dFN0YXRlID0gIWlzQW55T3BlbjsgLy8gSWYgYW55IG9wZW4gLT4gaGlkZSBhbGwgZGV0YWlscyAoZmFsc2UpOyBpZiBhbGwgY2xvc2VkIC0+IHNob3cgYWxsIGRldGFpbHMgKHRydWUpXG4gICAgY29uc3QgdXBkYXRlZCA9IHt9O1xuICAgIGdyYWRlTGlzdC5mb3JFYWNoKChtKSA9PiB7XG4gICAgICB1cGRhdGVkW20uaWRdID0gbmV4dFN0YXRlO1xuICAgIH0pO1xuICAgIHNldE9wZW5TdGF0ZXModXBkYXRlZCk7XG4gIH07XG4gIGNvbnN0IGhhbmRsZUl0ZW1UeXBlID0gKGl0ZW0pID0+IHtcbiAgICBpZiAoIWl0ZW0gfHwgIWl0ZW0udHlwZSkgcmV0dXJuIFwiYXNzaWdubWVudFwiOyAvLyBEZWZhdWx0IHRvIGFzc2lnbm1lbnQgaWYgdHlwZSBpcyBtaXNzaW5nXG4gICAgaWYgKGl0ZW0/LnF1aXpfbHRpICYmIGl0ZW0/LnF1aXpfbHRpID09IHRydWUpIHtcbiAgICAgIHJldHVybiBcInF1aXpcIjtcbiAgICB9XG4gICAgcmV0dXJuIGl0ZW0udHlwZS50b0xvd2VyQ2FzZSgpOyAvLyBSZXR1cm4gdGhlIHR5cGUgaW4gbG93ZXJjYXNlIGZvciBjb25zaXN0ZW5jeVxuICB9O1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPSdwYWdlLWRpdicgc3R5bGU9e3sgbWFyZ2luQm90dG9tOiBcIjRlbVwiIH19PlxuICAgICAgPGRpdlxuICAgICAgICBzdHlsZT17e1xuICAgICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICAgIGp1c3RpZnlDb250ZW50OiBcInNwYWNlLWJldHdlZW5cIixcbiAgICAgICAgICBhbGlnbkl0ZW1zOiBcImNlbnRlclwiLFxuICAgICAgICB9fVxuICAgICAgPlxuICAgICAgICA8aDEgc3R5bGU9e3sgY29sb3I6IFwiIzY2NjY2NlwiLCBmb250U2l6ZTogMjguOCB9fT5HcmFkZXM8L2gxPlxuICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgb25DbGljaz17aGFuZGxlTWFzdGVyVG9nZ2xlfVxuICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiI2YyZjRmNFwiLFxuICAgICAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCAjZThlYWVjXCIsXG4gICAgICAgICAgICBwYWRkaW5nOiBcIjhweCAxNHB4IDhweCAxNHB4XCIsXG4gICAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiM3B4XCIsXG4gICAgICAgICAgICBjdXJzb3I6IFwicG9pbnRlclwiLFxuICAgICAgICAgICAgZm9udFNpemU6IFwiMTZweFwiLFxuICAgICAgICAgICAgY29sb3I6IFwiIzI3MzU0MFwiLFxuICAgICAgICAgIH19XG4gICAgICAgID5cbiAgICAgICAgICB7IWlzQW55T3BlbiA/IFwiSGlkZSBBbGwgRGV0YWlsc1wiIDogXCJTaG93IEFsbCBEZXRhaWxzXCJ9XG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzTmFtZT0nZ3JhZGVzLXNvcnRpbmcnXG4gICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgbWFyZ2luQm90dG9tOiBcIi41ZW1cIixcbiAgICAgICAgICBtYXJnaW5Ub3A6IFwiLjVlbVwiLFxuICAgICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICAgIGZsZXhEaXJlY3Rpb246IFwicm93XCIsXG4gICAgICAgICAganVzdGlmeUNvbnRlbnQ6IFwibGVmdFwiLFxuICAgICAgICB9fVxuICAgICAgPlxuICAgICAgICB7Z3JhZGluZ1BlcmlvZHMgJiYgKFxuICAgICAgICAgIDxzcGFuXG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICAgICAgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIixcbiAgICAgICAgICAgICAganVzdGlmeUNvbnRlbnQ6IFwibGVmdFwiLFxuICAgICAgICAgICAgICBnYXA6IFwiMC41ZW1cIixcbiAgICAgICAgICAgICAgZm9udFNpemU6IFwiMWVtXCIsXG4gICAgICAgICAgICAgIG1hcmdpblJpZ2h0OiBcIjJlbVwiLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICA8bGFiZWwgaHRtbEZvcj0nZ3JhZGluZ19wZXJpb2QnPlxuICAgICAgICAgICAgICA8c3Ryb25nPkdyYWRpbmcgUGVyaW9kPC9zdHJvbmc+XG4gICAgICAgICAgICA8L2xhYmVsPlxuXG4gICAgICAgICAgICA8c2VsZWN0XG4gICAgICAgICAgICAgIG5hbWU9J2dyYWRpbmdfcGVyaW9kJ1xuICAgICAgICAgICAgICBpZD0nZ3JhZGluZ19wZXJpb2QnXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT0nZHJvcGRvd24tc2VsZWN0J1xuICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHNldFNlbGVjdGVkR3JhZGluZ1BlcmlvZChlLnRhcmdldC52YWx1ZSl9XG4gICAgICAgICAgICAgIHZhbHVlPXtzZWxlY3RlZEdyYWRpbmdQZXJpb2R9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9J2FsbCc+QWxsIEdyYWRpbmcgUGVyaW9kczwvb3B0aW9uPlxuICAgICAgICAgICAgICB7Z3JhZGluZ1BlcmlvZHMubWFwKChwZXJpb2QpID0+IChcbiAgICAgICAgICAgICAgICA8b3B0aW9uIGtleT17cGVyaW9kLmlkfSB2YWx1ZT17cGVyaW9kLmlkfT5cbiAgICAgICAgICAgICAgICAgIHtwZXJpb2QudGl0bGUgfHwgcGVyaW9kLmRpc3BsYXlfbmFtZX1cbiAgICAgICAgICAgICAgICA8L29wdGlvbj5cbiAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICA8L3NlbGVjdD5cbiAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICl9XG4gICAgICAgIDxzcGFuXG4gICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICAgICAgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIixcbiAgICAgICAgICAgIGp1c3RpZnlDb250ZW50OiBcImxlZnRcIixcbiAgICAgICAgICAgIGdhcDogXCIwLjVlbVwiLFxuICAgICAgICAgICAgZm9udFNpemU6IFwiMWVtXCIsXG4gICAgICAgICAgfX1cbiAgICAgICAgPlxuICAgICAgICAgIDxsYWJlbCBodG1sRm9yPSdncmFkZXMtc29ydGluZy1kcm9wZG93bic+XG4gICAgICAgICAgICA8c3Ryb25nPkFycmFuZ2UgQnk8L3N0cm9uZz5cbiAgICAgICAgICA8L2xhYmVsPlxuICAgICAgICAgIDxzZWxlY3QgaWQ9J2dyYWRlcy1zb3J0aW5nLWRyb3Bkb3duJyBjbGFzc05hbWU9J2Ryb3Bkb3duLXNlbGVjdCcgb25DaGFuZ2U9eyhlKSA9PiBzZXRTb3J0QnkoZS50YXJnZXQudmFsdWUpfSB2YWx1ZT17c29ydEJ5fT5cbiAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9J2R1ZSc+RHVlIERhdGU8L29wdGlvbj5cbiAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9J25hbWUnPk5hbWU8L29wdGlvbj5cbiAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9J3N1Ym1pdHRlZCc+U3VibWl0dGVkIERhdGU8L29wdGlvbj5cbiAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9J2Fzc2lnbm1lbnRfZ3JvdXAnPkFzc2lnbm1lbnQgR3JvdXA8L29wdGlvbj5cbiAgICAgICAgICA8L3NlbGVjdD5cbiAgICAgICAgPC9zcGFuPlxuICAgICAgICA8c3BhblxuICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICAgIGZsZXhHcm93OiAxLFxuICAgICAgICAgICAganVzdGlmeUNvbnRlbnQ6IFwicmlnaHRcIixcbiAgICAgICAgICAgIG1hcmdpblJpZ2h0OiBcIjJlbVwiLFxuICAgICAgICAgIH19XG4gICAgICAgID5cbiAgICAgICAgICBUb3RhbDp7XCIgXCJ9XG4gICAgICAgICAge2NhbGN1bGF0ZVRvdGFsV2VpZ2h0ZWRHcmFkZShncmFkZUxpc3QsIHVzZUFzc2lnbm1lbnRHcm91cHNGb3JXZWlnaHRpbmcgPyBhc3NpZ25tZW50R3JvdXBzIDogdW5kZWZpbmVkKVxuICAgICAgICAgICAgPyBjYWxjdWxhdGVUb3RhbFdlaWdodGVkR3JhZGUoZ3JhZGVMaXN0LCB1c2VBc3NpZ25tZW50R3JvdXBzRm9yV2VpZ2h0aW5nID8gYXNzaWdubWVudEdyb3VwcyA6IHVuZGVmaW5lZCk/LnRvRml4ZWQoMikgKyBcIiVcIlxuICAgICAgICAgICAgOiBcIk4vQVwifVxuICAgICAgICA8L3NwYW4+XG4gICAgICA8L2Rpdj5cbiAgICAgIDx0YWJsZSBjbGFzc05hbWU9J2dyYWRlcy10YWJsZSc+XG4gICAgICAgIDx0aGVhZD5cbiAgICAgICAgICA8dHIgY2xhc3NOYW1lPSdncmFkZXMtdGFibGUtaGVhZGVyJz5cbiAgICAgICAgICAgIDx0aD5OYW1lPC90aD5cbiAgICAgICAgICAgIDx0aD5EdWU8L3RoPlxuICAgICAgICAgICAgPHRoPlN1Ym1pdHRlZDwvdGg+XG4gICAgICAgICAgICA8dGg+U3RhdHVzPC90aD5cbiAgICAgICAgICAgIDx0aD5TY29yZTwvdGg+XG4gICAgICAgICAgICA8dGg+PC90aD5cbiAgICAgICAgICA8L3RyPlxuICAgICAgICA8L3RoZWFkPlxuICAgICAgICA8dGJvZHkgY2xhc3NOYW1lPSdncmFkZXMtdGFibGUtYm9keSc+XG4gICAgICAgICAge2dyYWRlTGlzdC5tYXAoKGdyYWRlLCBpbmRleCkgPT4gKFxuICAgICAgICAgICAgPEdyYWRlVGFibGVSb3dcbiAgICAgICAgICAgICAgYXNzaWdubWVudD17Z3JhZGV9XG4gICAgICAgICAgICAgIGRldGFpbHNIaWRkZW49e29wZW5TdGF0ZXNbZ3JhZGUuaWRdID8/IHRydWV9XG4gICAgICAgICAgICAgIGhpZGVEZXRhaWxDYWxsYmFjaz17KCkgPT4gaGFuZGxlVG9nZ2xlTW9kdWxlKGdyYWRlLmlkKX1cbiAgICAgICAgICAgICAgYXNzaWdubWVudEdyb3Vwcz17YXNzaWdubWVudEdyb3Vwc31cbiAgICAgICAgICAgICAga2V5PXtpbmRleH1cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgKSl9XG4gICAgICAgICAge2Fzc2lnbm1lbnRHcm91cHMgJiZcbiAgICAgICAgICAgIGFzc2lnbm1lbnRHcm91cHMubGVuZ3RoID4gMCAmJlxuICAgICAgICAgICAgYXNzaWdubWVudEdyb3Vwcy5tYXAoKGdyb3VwLCBpbmRleCkgPT4gKFxuICAgICAgICAgICAgICA8dHIgY2xhc3NOYW1lPSdncmFkZS1yb3cnIGtleT17aW5kZXh9PlxuICAgICAgICAgICAgICAgIDx0ZCBjb2xTcGFuPSc0Jz5cbiAgICAgICAgICAgICAgICAgIDxzdHJvbmc+e2dyb3VwLm5hbWV9PC9zdHJvbmc+XG4gICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICA8dGQgc3R5bGU9e3sgdGV4dEFsaWduOiBcImNlbnRlclwiIH19PlxuICAgICAgICAgICAgICAgICAgPHN0cm9uZz5cbiAgICAgICAgICAgICAgICAgICAge2NhbGN1bGF0ZUdyYWRlRm9yR3JvdXAoZ3JvdXAsIGdyYWRlTGlzdCk/LnBlcmNlbnRhZ2U/LnRvRml4ZWQoMilcbiAgICAgICAgICAgICAgICAgICAgICA/IGNhbGN1bGF0ZUdyYWRlRm9yR3JvdXAoZ3JvdXAsIGdyYWRlTGlzdCk/LnBlcmNlbnRhZ2U/LnRvRml4ZWQoMikgKyBcIiVcIlxuICAgICAgICAgICAgICAgICAgICAgIDogXCJOL0FcIn1cbiAgICAgICAgICAgICAgICAgIDwvc3Ryb25nPlxuICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgPHRkIHN0eWxlPXt7IHRleHRBbGlnbjogXCJyaWdodFwiIH19PlxuICAgICAgICAgICAgICAgICAgPHN0cm9uZyBzdHlsZT17eyB3aGl0ZVNwYWNlOiBcIm5vd3JhcFwiIH19PlxuICAgICAgICAgICAgICAgICAgICB7Y2FsY3VsYXRlR3JhZGVGb3JHcm91cChncm91cCwgZ3JhZGVMaXN0KT8udG90YWxQb2ludHNFYXJuZWQ/LnRvRml4ZWQoMikgfHwgXCJOL0FcIn0gL3tcIiBcIn1cbiAgICAgICAgICAgICAgICAgICAge2NhbGN1bGF0ZUdyYWRlRm9yR3JvdXAoZ3JvdXAsIGdyYWRlTGlzdCk/LnRvdGFsUG9pbnRzUG9zc2libGU/LnRvRml4ZWQoMikgfHwgXCJOL0FcIn1cbiAgICAgICAgICAgICAgICAgIDwvc3Ryb25nPlxuICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICApKX1cbiAgICAgICAgICA8dHIgY2xhc3NOYW1lPSdncmFkZS1yb3cgZ3JhZGUtcm93LXRvdGFsJz5cbiAgICAgICAgICAgIDx0ZCBjb2xTcGFuPSc0JyBzdHlsZT17eyB0ZXh0QWxpZ246IFwibGVmdFwiLCB0ZXh0V3JhcDogXCJub3dyYXBcIiB9fT5cbiAgICAgICAgICAgICAgPHN0cm9uZz5Ub3RhbDwvc3Ryb25nPlxuICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgIDx0ZCBzdHlsZT17eyB0ZXh0QWxpZ246IFwiY2VudGVyXCIgfX0+XG4gICAgICAgICAgICAgIDxzdHJvbmc+XG4gICAgICAgICAgICAgICAge2NhbGN1bGF0ZVRvdGFsV2VpZ2h0ZWRHcmFkZShncmFkZUxpc3QsIHVzZUFzc2lnbm1lbnRHcm91cHNGb3JXZWlnaHRpbmcgPyBhc3NpZ25tZW50R3JvdXBzIDogdW5kZWZpbmVkKVxuICAgICAgICAgICAgICAgICAgPyBjYWxjdWxhdGVUb3RhbFdlaWdodGVkR3JhZGUoZ3JhZGVMaXN0LCB1c2VBc3NpZ25tZW50R3JvdXBzRm9yV2VpZ2h0aW5nID8gYXNzaWdubWVudEdyb3VwcyA6IHVuZGVmaW5lZCk/LnRvRml4ZWQoMikgKyBcIiVcIlxuICAgICAgICAgICAgICAgICAgOiBcIk4vQVwifVxuICAgICAgICAgICAgICA8L3N0cm9uZz5cbiAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICA8dGQgc3R5bGU9e3sgdGV4dEFsaWduOiBcImNlbnRlclwiIH19PlxuICAgICAgICAgICAgICA8c3Ryb25nPlxuICAgICAgICAgICAgICAgIHtjYWxjdWxhdGVUb3RhbFBvaW50cyhncmFkZUxpc3QpPy50b3RhbFBvaW50c0Vhcm5lZD8udG9GaXhlZCgyKSB8fCBcIk4vQVwifSAve1wiIFwifVxuICAgICAgICAgICAgICAgIHtjYWxjdWxhdGVUb3RhbFBvaW50cyhncmFkZUxpc3QpPy50b3RhbFBvaW50c1Bvc3NpYmxlPy50b0ZpeGVkKDIpIHx8IFwiTi9BXCJ9XG4gICAgICAgICAgICAgIDwvc3Ryb25nPlxuICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICA8L3RyPlxuICAgICAgICA8L3Rib2R5PlxuICAgICAgPC90YWJsZT5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPSdncm91cC13ZWlnaHRpbmcnPlxuICAgICAgICB7IXVzZUFzc2lnbm1lbnRHcm91cHNGb3JXZWlnaHRpbmcgfHwgIWFzc2lnbm1lbnRHcm91cHMgfHwgYXNzaWdubWVudEdyb3Vwcy5sZW5ndGggPT09IDAgPyAoXG4gICAgICAgICAgPHAgY2xhc3NOYW1lPSduby13ZWlnaHRpbmctdGV4dCc+Q291cnNlIGFzc2lnbm1lbnRzIGFyZSBub3Qgd2VpZ2h0ZWQuPC9wPlxuICAgICAgICApIDogKFxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSd3ZWlnaHRpbmctY29udGFpbmVyJz5cbiAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9J3dlaWdodGluZy10aXRsZSc+Q291cnNlIFdlaWdodGluZzwvaDM+XG4gICAgICAgICAgICA8dGFibGUgY2xhc3NOYW1lPSd3ZWlnaHRpbmctdGFibGUnPlxuICAgICAgICAgICAgICA8dGhlYWQ+XG4gICAgICAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICAgICAgPHRoPkdyb3VwPC90aD5cbiAgICAgICAgICAgICAgICAgIDx0aD5XZWlnaHQ8L3RoPlxuICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgIDwvdGhlYWQ+XG4gICAgICAgICAgICAgIDx0Ym9keT5cbiAgICAgICAgICAgICAgICB7YXNzaWdubWVudEdyb3Vwcy5tYXAoKGdyb3VwLCBpbmRleCkgPT4gKFxuICAgICAgICAgICAgICAgICAgPHRyIGtleT17Z3JvdXAuaWQgfHwgaW5kZXh9PlxuICAgICAgICAgICAgICAgICAgICA8dGQ+e2dyb3VwLm5hbWV9PC90ZD5cbiAgICAgICAgICAgICAgICAgICAgPHRkPntncm91cC5ncm91cF93ZWlnaHQgIT09IHVuZGVmaW5lZCAmJiBncm91cC5ncm91cF93ZWlnaHQgIT09IG51bGwgPyBgJHtncm91cC5ncm91cF93ZWlnaHR9JWAgOiBcIk4vQVwifTwvdGQ+XG4gICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICA8L3Rib2R5PlxuICAgICAgICAgICAgPC90YWJsZT5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKX1cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufVxuLyoqXG4gKiBSZW5kZXJzIGEgc2luZ2xlIHRhYmxlIHJvdyBmb3IgdGhlIGdyYWRlIHRhYmxlXG4gKiBAcGFyYW0ge09iamVjdH0gcHJvcHNcbiAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wcy5hc3NpZ25tZW50IC0gVGhlIGFzc2lnbm1lbnQgdG8gcmVuZGVyXG4gKiBAcGFyYW0ge2Jvb2xlYW59IHByb3BzLmRldGFpbHNIaWRkZW4gLSBXaGV0aGVyIHRoZSBkZXRhaWxzIGFyZSBoaWRkZW5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IHByb3BzLmhpZGVEZXRhaWxDYWxsYmFjayAtIFRoZSBjYWxsYmFjayB0byBoaWRlIHRoZSBkZXRhaWxzXG4gKiBAcGFyYW0ge0FycmF5PE9iamVjdD59IHByb3BzLmFzc2lnbm1lbnRHcm91cHMgLSBUaGUgYXNzaWdubWVudCBncm91cHNcbiAqIEByZXR1cm5zIGEgc2luZ2xlIHRhYmxlIHJvdyBmb3IgdGhlIGdyYWRlIHRhYmxlXG4gKi9cbmZ1bmN0aW9uIEdyYWRlVGFibGVSb3coeyBhc3NpZ25tZW50LCBkZXRhaWxzSGlkZGVuLCBoaWRlRGV0YWlsQ2FsbGJhY2ssIGFzc2lnbm1lbnRHcm91cHMgfSkge1xuICBjb25zdCB7IG5hdmlnYXRlVG9Bc3NpZ25tZW50IH0gPSB1c2VOYXZpZ2F0aW9uKCk7XG4gIGNvbnN0IHsgcmVjb25uZWN0Rm9sZGVyIH0gPSB1c2VDb3Vyc2VDb250ZXh0KCk7XG5cbiAgbGV0IGFzc2lnbm1lbnRHcm91cE5hbWUgPSBcIlVua25vd24gQXNzaWdubWVudCBHcm91cFwiO1xuICBpZiAoYXNzaWdubWVudEdyb3VwcyAmJiBhc3NpZ25tZW50R3JvdXBzLmxlbmd0aCA+IDApIHtcbiAgICAvLyB0YWtlcyBhIGxpc3Qgb2YgYXNzaWdubWVudCBncm91cHMgYW5kIGZpbmRzIHRoZSBuYW1lIG9mIHRoZSBncm91cCB0aGF0IG1hdGNoZXMgdGhlIGFzc2lnbm1lbnQncyBncm91cCBJRFxuICAgIGFzc2lnbm1lbnRHcm91cE5hbWUgPVxuICAgICAgYXNzaWdubWVudEdyb3Vwcy5maWx0ZXIoKGdyb3VwKSA9PiBncm91cC5pZCA9PT0gYXNzaWdubWVudC5hc3NpZ25tZW50X2dyb3VwX2lkKVswXT8ubmFtZSB8fCBcIlVua25vd24gQXNzaWdubWVudCBHcm91cFwiO1xuICB9XG4gIGxldCBjaGVja21hcmsgPSAoXG4gICAgPHN2ZyB2aWV3Qm94PScwIDAgMTkyMCAxOTIwJyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHN0eWxlPXt7IGhlaWdodDogXCIxNnB4XCIsIHdpZHRoOiBcIjE2cHhcIiB9fT5cbiAgICAgIDxwYXRoIGQ9J00xODI3LjcwMSAzMDMuMDY1IDY5OC44MzUgMTQzMS44MDEgOTIuMjk5IDgyNS4yNjYgMCA5MTcuNTY0IDY5OC44MzUgMTYxNi40IDE5MTkuODY5IDM5NS4yMzR6JyAvPlxuICAgIDwvc3ZnPlxuICApO1xuICBsZXQgeG1hcmsgPSAoXG4gICAgPHN2ZyB2aWV3Qm94PScwIDAgMTkyMCAxOTIwJyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHN0eWxlPXt7IGhlaWdodDogXCIxNnB4XCIsIHdpZHRoOiBcIjE2cHhcIiB9fT5cbiAgICAgIDxwYXRoIGQ9J005NTQuNjQgODI2LjQxOCA0MjYuNjY3IDI5OC40NDUgMjk4LjQ0NSA0MjYuNjY3IDgyNi40MTggOTU0LjY0bC01MjcuOTczIDUyNy45NzMgMTI4LjIyMiAxMjguMjIyIDUyNy45NzMtNTI3Ljk3MyA1MjcuOTczIDUyNy45NzMgMTI4LjIyMi0xMjguMjIyLTUyNy45NzMtNTI3Ljk3MyA1MjcuOTczLTUyNy45NzMtMTI4LjIyMi0xMjguMjIyeicgLz5cbiAgICA8L3N2Zz5cbiAgKTtcbiAgY29uc3QgcmVuZGVyR3JhZGUgPSAoYXNzaWdubWVudCkgPT4ge1xuICAgIGNvbnN0IHsgZ3JhZGluZ190eXBlLCBwb2ludHNfcG9zc2libGUsIHN1Ym1pc3Npb24gfSA9IGFzc2lnbm1lbnQgfHwge307XG5cbiAgICBpZiAoZ3JhZGluZ190eXBlID09PSBcInBvaW50c1wiKSB7XG4gICAgICByZXR1cm4gYCR7c3VibWlzc2lvbj8uc2NvcmUgPz8gXCItXCJ9IC8gJHtwb2ludHNfcG9zc2libGUgPz8gXCItXCJ9YDtcbiAgICB9XG5cbiAgICBpZiAoZ3JhZGluZ190eXBlID09PSBcInBhc3NfZmFpbFwiKSB7XG4gICAgICByZXR1cm4gc3VibWlzc2lvbj8uZ3JhZGUgPT09IFwiY29tcGxldGVcIiA/IGNoZWNrbWFyayA6IHhtYXJrO1xuICAgIH1cblxuICAgIGlmIChncmFkaW5nX3R5cGUgPT09IFwibm90X2dyYWRlZFwiKSB7XG4gICAgICByZXR1cm4gXCItXCI7XG4gICAgfVxuICAgIGlmIChncmFkaW5nX3R5cGUgPT0gXCJsZXR0ZXJfZ3JhZGVcIikge1xuICAgICAgcmV0dXJuIGAke3N1Ym1pc3Npb24/LnNjb3JlfSAoJHtzdWJtaXNzaW9uPy5ncmFkZX0pYDtcbiAgICB9XG5cbiAgICByZXR1cm4gXCItXCI7XG4gIH07XG5cbiAgcmV0dXJuIChcbiAgICA8PlxuICAgICAgPHRyIGNsYXNzTmFtZT0nZ3JhZGUtcm93JyBrZXk9e2Fzc2lnbm1lbnQuaWR9PlxuICAgICAgICA8dGQgc3R5bGU9e3sgbWF4V2lkdGg6IFwiMzAlXCIgfX0+XG4gICAgICAgICAgPGFcbiAgICAgICAgICAgIGhyZWY9JyMnXG4gICAgICAgICAgICBjbGFzc05hbWU9J2Fzc2lnbm1lbnQtbGluaydcbiAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcbiAgICAgICAgICAgICAgcmVjb25uZWN0Rm9sZGVyKCk7XG4gICAgICAgICAgICAgIG5hdmlnYXRlVG9Bc3NpZ25tZW50KGFzc2lnbm1lbnQ/LmlkKTtcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgPlxuICAgICAgICAgICAge2Fzc2lnbm1lbnQubmFtZX1cbiAgICAgICAgICA8L2E+XG4gICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250U2l6ZTogXCIxNHB4XCIsIGNvbG9yOiBcInJnYigzOSwgNTMsIDY0KVwiIH19Pnthc3NpZ25tZW50R3JvdXBOYW1lfTwvZGl2PlxuICAgICAgICA8L3RkPlxuICAgICAgICA8dGQ+e2Fzc2lnbm1lbnQuZHVlX2F0ID8gZml4RGF0ZUZvcm1hdChhc3NpZ25tZW50LmR1ZV9hdCkgOiBcIlwifTwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT17eyB0ZXh0QWxpZ246IFwibGVmdFwiIH19PlxuICAgICAgICAgIHthc3NpZ25tZW50LnN1Ym1pc3Npb24/LnN1Ym1pdHRlZF9hdCA/IGZpeERhdGVGb3JtYXQoYXNzaWdubWVudC5zdWJtaXNzaW9uPy5zdWJtaXR0ZWRfYXQpIDogXCJcIn1cbiAgICAgICAgPC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPXt7IHRleHRBbGlnbjogXCJjZW50ZXJcIiB9fT5cbiAgICAgICAgICB7YXNzaWdubWVudC5zdWJtaXNzaW9uPy5sYXRlICYmICFhc3NpZ25tZW50LnN1Ym1pc3Npb24/Lm1pc3NpbmcgJiYgPENvbnRleHRQaWxsIHR5cGU9J2xhdGUnIC8+fVxuICAgICAgICAgIHthc3NpZ25tZW50LnN1Ym1pc3Npb24/Lm1pc3NpbmcgJiYgPENvbnRleHRQaWxsIHR5cGU9J21pc3NpbmcnIC8+fVxuICAgICAgICA8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9e3sgdGV4dEFsaWduOiBcImNlbnRlclwiLCB3aGl0ZVNwYWNlOiBcIm5vd3JhcFwiIH19PntyZW5kZXJHcmFkZShhc3NpZ25tZW50KX08L3RkPlxuICAgICAgICA8dGQ+XG4gICAgICAgICAgey8qQWRkIGRldGFpbHMgYnV0dG9uLCBjb3VudCB0d29hcmRzIGZpbmFsIGdyYWRlLCBhbmQgKGNvbW1lbnRzKT8qL31cbiAgICAgICAgICB7IWFzc2lnbm1lbnQ/LnNjb3JlX3N0YXRpc3RpY3MgPyBudWxsIDogKFxuICAgICAgICAgICAgPHN2Z1xuICAgICAgICAgICAgICB2aWV3Qm94PScwIDAgMTkyMCAxOTIwJ1xuICAgICAgICAgICAgICB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnXG4gICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgd2lkdGg6IFwiMTZweFwiLFxuICAgICAgICAgICAgICAgIGhlaWdodDogXCIxNnB4XCIsXG4gICAgICAgICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsXG4gICAgICAgICAgICAgICAganVzdGlmeUNvbnRlbnQ6IFwiY2VudGVyXCIsXG4gICAgICAgICAgICAgICAgYWxpZ25JdGVtczogXCJjZW50ZXJcIixcbiAgICAgICAgICAgICAgICBjdXJzb3I6IFwicG9pbnRlclwiLFxuICAgICAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogXCIjZjJmNGY0XCIsXG4gICAgICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiBcIjRweFwiLFxuICAgICAgICAgICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgI2U4ZWFlY1wiLFxuICAgICAgICAgICAgICAgIGNvbG9yOiBcInJnYig5OSwgMTA5LCAxMTcpXCIsXG4gICAgICAgICAgICAgICAgcGFkZGluZzogXCIuNWVtXCIsXG4gICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgIG9uQ2xpY2s9e2hpZGVEZXRhaWxDYWxsYmFja31cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgICAgICBkPSdNMTcwOS4yODkgOTU5LjY3M3Y4NTQuNjA0SDM0MS44MDh2LTc5Ny43NDRoMTEzLjk0N3Y2ODMuNzk3SDE1OTUuMzRWOTU5LjY3M2gxMTMuOTQ4Wk0xODQwLjM1IDQzNC41N2w3OS42NSA4MS41ODYtNzk3LjYzIDc3OS42MjctMzY0LjUxOC0zNTYuNTQgNzkuNjQ5LTgxLjM2IDI4NC44NjggMjc4LjQ4OCA3MTcuOTgyLTcwMS44MDFaTTQ1NS43ODkgMTA1djM0MS45NTZoMzQxLjk1NnYxMTMuOTQ3SDQ1NS43ODl2MzQxLjcyOEgzNDEuODQyVjU2MC45MDNIMFY0NDYuOTU2aDM0MS44NDJWMTA1aDExMy45NDdabTEwODIuNTMzIDM0MS44NzZ2MTEzLjk0N2gtNjI2LjcxVjQ0Ni44NzZoNjI2LjcxWidcbiAgICAgICAgICAgICAgICBmaWxsLXJ1bGU9J2V2ZW5vZGQnXG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICApfVxuICAgICAgICAgIHshYXNzaWdubWVudD8ub21pdF9mcm9tX2ZpbmFsX2dyYWRlID8gbnVsbCA6IChcbiAgICAgICAgICAgIDxzdmdcbiAgICAgICAgICAgICAgdmlld0JveD0nMCAwIDE5MjAgMTkyMCdcbiAgICAgICAgICAgICAgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJ1xuICAgICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICAgIHdpZHRoOiBcIjE2cHhcIixcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IFwiMTZweFwiLFxuICAgICAgICAgICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICAgICAgICAgIGp1c3RpZnlDb250ZW50OiBcImNlbnRlclwiLFxuICAgICAgICAgICAgICAgIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsXG4gICAgICAgICAgICAgICAgY3Vyc29yOiBcInBvaW50ZXJcIixcbiAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiI2YyZjRmNFwiLFxuICAgICAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCI0cHhcIixcbiAgICAgICAgICAgICAgICBib3JkZXI6IFwiMXB4IHNvbGlkICNlOGVhZWNcIixcbiAgICAgICAgICAgICAgICBjb2xvcjogXCJyZ2IoOTksIDEwOSwgMTE3KVwiLFxuICAgICAgICAgICAgICAgIHBhZGRpbmc6IFwiLjVlbVwiLFxuICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICBvbkNsaWNrPXtoaWRlRGV0YWlsQ2FsbGJhY2t9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIDxwYXRoXG4gICAgICAgICAgICAgICAgZD0nTTk2MCAwYzUzMC4xOTMgMCA5NjAgNDI5LjgwNyA5NjAgOTYwcy00MjkuODA3IDk2MC05NjAgOTYwUzAgMTQ5MC4xOTMgMCA5NjAgNDI5LjgwNyAwIDk2MCAwWm0wIDEwMS4wNTNjLTQ3NC4zODQgMC04NTguOTQ3IDM4NC41NjMtODU4Ljk0NyA4NTguOTQ3UzQ4NS42MTYgMTgxOC45NDcgOTYwIDE4MTguOTQ3IDE4MTguOTQ3IDE0MzQuMzg0IDE4MTguOTQ3IDk2MCAxNDM0LjM4NCAxMDEuMDUzIDk2MCAxMDEuMDUzWm0tOS4zMiAxMjIxLjQ5Yy04MC4wMjQgMC0xNDUuMTI4IDY1LjEwNS0xNDUuMTI4IDE0NS4xMjkgMCA4MC4wMjQgNjUuMTA0IDE0NS4xMjggMTQ1LjEyOCAxNDUuMTI4IDgwLjAyNCAwIDE0NS4xMjgtNjUuMTA0IDE0NS4xMjgtMTQ1LjEyOCAwLTgwLjAyNC02NS4xMDQtMTQ1LjEyOC0xNDUuMTI4LTE0NS4xMjhabTE5Mi43ODUtOTY4Ljg1OWgtMzg1LjU3bDkzLjkwMSA4NTEuMzI3aDE5Ny43NjhsOTMuOTAxLTg1MS4zMjdaJ1xuICAgICAgICAgICAgICAgIGZpbGwtcnVsZT0nZXZlbm9kZCdcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgICl9XG4gICAgICAgIDwvdGQ+XG4gICAgICA8L3RyPlxuICAgICAgPHRyXG4gICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgZGlzcGxheTogZGV0YWlsc0hpZGRlbiB8fCAhYXNzaWdubWVudD8ub21pdF9mcm9tX2ZpbmFsX2dyYWRlID8gXCJub25lXCIgOiBcInRhYmxlLXJvd1wiLFxuICAgICAgICB9fVxuICAgICAgICBjbGFzc05hbWU9J2dyYWRlLXJvdy1kZXRhaWxzJ1xuICAgICAgICBrZXk9e2Ake2Fzc2lnbm1lbnQuaWR9LWRldGFpbHNgfVxuICAgICAgPlxuICAgICAgICA8dGQgY29sU3Bhbj0nNicgc3R5bGU9e3sgcGFkZGluZzogXCIwLjVlbSAxZW1cIiB9fT5cbiAgICAgICAgICA8c3Ryb25nPlRoaXMgQXNzaWdubWVudCBkb2VzIG5vdCBjb3VudCB0d29hcmRzIHRoZSBmaW5hbCBncmFkZS48L3N0cm9uZz5cbiAgICAgICAgPC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHJcbiAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICBkaXNwbGF5OiBkZXRhaWxzSGlkZGVuIHx8ICFhc3NpZ25tZW50Py5zY29yZV9zdGF0aXN0aWNzID8gXCJub25lXCIgOiBcInRhYmxlLXJvd1wiLFxuICAgICAgICB9fVxuICAgICAgICBjbGFzc05hbWU9J2dyYWRlLXJvdy1kZXRhaWxzJ1xuICAgICAgICBrZXk9e2Ake2Fzc2lnbm1lbnQuaWR9LWRldGFpbHNgfVxuICAgICAgPlxuICAgICAgICA8dGQgY29sU3Bhbj0nNicgc3R5bGU9e3sgcGFkZGluZzogXCIwLjVlbSAxZW1cIiB9fT5cbiAgICAgICAgICA8dGFibGVcbiAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgIG1heFdpZHRoOiBcIjkwJVwiLFxuICAgICAgICAgICAgICBtaW5XaWR0aDogXCI4MCVcIixcbiAgICAgICAgICAgICAgYm9yZGVyQ29sbGFwc2U6IFwiY29sbGFwc2VcIixcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgPlxuICAgICAgICAgICAgPHRoZWFkIHN0eWxlPXt7IGJvcmRlckJvdHRvbTogXCIxcHggc29saWQgI2NjY1wiIH19PlxuICAgICAgICAgICAgICA8dHJcbiAgICAgICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICAgICAgd2lkdGg6IFwiMTAwJVwiLFxuICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8dGggY29sU3Bhbj0nMycgc3R5bGU9e3sgdGV4dEFsaWduOiBcImxlZnRcIiB9fT5cbiAgICAgICAgICAgICAgICAgIFNjb3JlIERldGFpbHNcbiAgICAgICAgICAgICAgICA8L3RoPlxuICAgICAgICAgICAgICAgIDx0aCBzdHlsZT17eyB0ZXh0QWxpZ246IFwicmlnaHRcIiwgcGFkZGluZ1JpZ2h0OiBcIjFlbVwiIH19PlxuICAgICAgICAgICAgICAgICAgPGEgb25DbGljaz17aGlkZURldGFpbENhbGxiYWNrfSBjbGFzc05hbWU9J2Fzc2lnbm1lbnQtbGluaycgc3R5bGU9e3sgZmxvYXQ6IFwicmlnaHRcIiwgZm9udFdlaWdodDogXCJub3JtYWxcIiB9fT5cbiAgICAgICAgICAgICAgICAgICAgQ2xvc2VcbiAgICAgICAgICAgICAgICAgIDwvYT5cbiAgICAgICAgICAgICAgICA8L3RoPlxuICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgPC90aGVhZD5cbiAgICAgICAgICAgIDx0Ym9keT5cbiAgICAgICAgICAgICAgPHRyIGNsYXNzTmFtZT0nZ3JhZGUtcm93JyBzdHlsZT17eyBmb250U2l6ZTogXCIxNHB4XCIsIGNvbG9yOiBcInJnYigzOSwgNTMsIDY0KVwiIH19PlxuICAgICAgICAgICAgICAgIDx0ZD5cbiAgICAgICAgICAgICAgICAgIE1lYW46IHthc3NpZ25tZW50Py5zY29yZV9zdGF0aXN0aWNzPy5tZWFuIHx8IFwiLVwifSA8YnIgLz4gTWVkaWFuOiB7YXNzaWdubWVudD8uc2NvcmVfc3RhdGlzdGljcz8ubWVkaWFuIHx8IFwiLVwifXtcIiBcIn1cbiAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgIDx0ZD5cbiAgICAgICAgICAgICAgICAgIEhpZ2g6IHthc3NpZ25tZW50Py5zY29yZV9zdGF0aXN0aWNzPy5tYXggfHwgXCItXCJ9IDxiciAvPiBVcHBlciBRdWFydGlsZToge2Fzc2lnbm1lbnQ/LnNjb3JlX3N0YXRpc3RpY3M/Lm1lZGlhbiB8fCBcIi1cIn17XCIgXCJ9XG4gICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICA8dGQ+XG4gICAgICAgICAgICAgICAgICBMb3c6IHthc3NpZ25tZW50Py5zY29yZV9zdGF0aXN0aWNzPy5taW4gfHwgXCIwXCJ9IDxiciAvPiBMb3dlciBRdWFydGlsZToge2Fzc2lnbm1lbnQ/LnNjb3JlX3N0YXRpc3RpY3M/Lm1lZGlhbiB8fCBcIi1cIn17XCIgXCJ9XG4gICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICA8dGQ+XG4gICAgICAgICAgICAgICAgICA8U2NvcmVEaXN0cmlidXRpb25HcmFwaCBhc3NpZ25tZW50PXthc3NpZ25tZW50fSAvPlxuICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICA8L3Rib2R5PlxuICAgICAgICAgIDwvdGFibGU+XG4gICAgICAgIDwvdGQ+XG4gICAgICA8L3RyPlxuICAgIDwvPlxuICApO1xufVxuIiwiLyoqXG4gKiBIb21lIFBhZ2UgY29tcG9uZW50IHRoYXQgZGlzcGxheXMgdGhlIGhvbWUgcGFnZSBjb250ZW50LiBJdCBjaGVja3MgaWYgdGhlIGNvdXJzZURhdGEgaXMgYXZhaWxhYmxlIGFuZCByZW5kZXJzIHRoZSBhcHByb3ByaWF0ZSBjb250ZW50LlxuICovXG5mdW5jdGlvbiBIb21lUGFnZSgpIHtcbiAgY29uc3QgeyBjb3Vyc2VEYXRhIH0gPSB1c2VDb3Vyc2VDb250ZXh0KCk7XG4gIGlmICghY291cnNlRGF0YSkge1xuICAgIHJldHVybiA8ZGl2PkxvYWRpbmcuLi48L2Rpdj47XG4gIH1cbiAgaWYgKCFjb3Vyc2VEYXRhLkZyb250UGFnZSkge1xuICAgIHJldHVybiA8ZGl2Pk5vIGNvdXJzZSBob21lIHBhZ2UgYXZhaWxhYmxlLjwvZGl2PjtcbiAgfSBlbHNlIGlmIChjb3Vyc2VEYXRhLkZyb250UGFnZSkge1xuICAgIHJldHVybiBjb3Vyc2VEYXRhLkZyb250UGFnZS5ib2R5ID8gKFxuICAgICAgPGRpdiBjbGFzc05hbWU9J3BhZ2UtZGl2Jz5cbiAgICAgICAgPGgxIHN0eWxlPXt7IGNvbG9yOiBcIiM2NjY2NjZcIiwgZm9udFNpemU6IDI4LjggfX0+e2NvdXJzZURhdGEubWFuaWZlc3QuY291cnNlfTwvaDE+XG4gICAgICAgIDxkaXYgaWQ9J2hvbWUtcGFnZS1jb250ZW50JyBkYW5nZXJvdXNseVNldElubmVySFRNTD17eyBfX2h0bWw6IGNvdXJzZURhdGEuRnJvbnRQYWdlLmJvZHkgfX0gLz5cbiAgICAgIDwvZGl2PlxuICAgICkgOiAoXG4gICAgICA8ZGl2Pk5vIGNvbnRlbnQgYXZhaWxhYmxlIGZvciB0aGUgY291cnNlIGhvbWUgcGFnZS48L2Rpdj5cbiAgICApO1xuICB9XG59XG4iLCJmdW5jdGlvbiBNYWluQ29udGVudCgpIHtcbiAgICAgIGNvbnN0IFtzaG93Q291cnNlTGlzdCwgc2V0U2hvd0NvdXJzZUxpc3RdID0gdXNlU3RhdGUodHJ1ZSk7XG4gICAgICBjb25zdCB7IGFjdGl2ZUtleSwgc2VsZWN0ZWRBc3NpZ25tZW50SWQsIHNlbGVjdGVkUGFnZVVybCwgc2VsZWN0ZWREaXNjdXNzaW9uSWQsIHNlbGVjdGVkQW5ub3VuY2VtZW50SWQsIG5hdmlnYXRlVG9TZWN0aW9uIH0gPVxuICAgICAgICB1c2VOYXZpZ2F0aW9uKCk7XG5cbiAgICAgIGNvbnN0IHsgY291cnNlRGF0YSB9ID0gdXNlQ291cnNlQ29udGV4dCgpO1xuXG4gICAgICBjb25zdCBlbGVtZW50cyA9IFJlYWN0LnVzZU1lbW8oKCkgPT4ge1xuICAgICAgICBpZiAoIWNvdXJzZURhdGEpIHJldHVybiBbXTtcbiAgICAgICAgY29uc29sZS5sb2coXCJDb3Vyc2UgZGF0YTpcIiwgY291cnNlRGF0YSk7XG4gICAgICAgIGNvbnN0IGxpc3QgPSBbXTtcbiAgICAgICAgaWYgKGNvdXJzZURhdGEuRnJvbnRQYWdlKSB7XG4gICAgICAgICAgbGlzdC5wdXNoKHsga2V5OiBcImZyb250cGFnZVwiLCB0aXRsZTogXCJIb21lXCIgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvdXJzZURhdGEuQXNzaWdubWVudHMpIHtcbiAgICAgICAgICBsaXN0LnB1c2goeyBrZXk6IFwiYXNzaWdubWVudHNcIiwgdGl0bGU6IFwiQXNzaWdubWVudHNcIiB9KTtcbiAgICAgICAgICBsaXN0LnB1c2goeyBrZXk6IFwiZ3JhZGVzXCIsIHRpdGxlOiBcIkdyYWRlc1wiIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb3Vyc2VEYXRhLk1vZHVsZXMpIHtcbiAgICAgICAgICBsaXN0LnB1c2goeyBrZXk6IFwibW9kdWxlc1wiLCB0aXRsZTogXCJNb2R1bGVzXCIgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvdXJzZURhdGEuRGlzY3Vzc2lvbnMgJiYgT2JqZWN0LmtleXMoY291cnNlRGF0YS5EaXNjdXNzaW9ucyB8fCB7fSkubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGxpc3QucHVzaCh7IGtleTogXCJkaXNjdXNzaW9uc1wiLCB0aXRsZTogXCJEaXNjdXNzaW9uc1wiIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb3Vyc2VEYXRhLkZpbGVzICYmIChjb3Vyc2VEYXRhLkZpbGVzPy5maWxlcz8ubGVuZ3RoID4gMCB8fCBjb3Vyc2VEYXRhLkZpbGVzPy5mb2xkZXJzPy5sZW5ndGggPiAxKSkge1xuICAgICAgICAgIGxpc3QucHVzaCh7IGtleTogXCJmaWxlc1wiLCB0aXRsZTogXCJGaWxlc1wiIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb3Vyc2VEYXRhLlBhZ2VzKSB7XG4gICAgICAgICAgbGlzdC5wdXNoKHsga2V5OiBcInBhZ2VzXCIsIHRpdGxlOiBcIlBhZ2VzXCIgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvdXJzZURhdGEuQW5ub3VuY2VtZW50cykge1xuICAgICAgICAgIGxpc3QucHVzaCh7IGtleTogXCJhbm5vdW5jZW1lbnRzXCIsIHRpdGxlOiBcIkFubm91bmNlbWVudHNcIiB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbGlzdDtcbiAgICAgIH0sIFtjb3Vyc2VEYXRhXSk7XG5cbiAgICAgIC8vIFNldCBpbml0aWFsIGFjdGl2ZSBrZXkgc2FmZWx5IGluIHVzZUVmZmVjdCB3aGVuIGNvdXJzZSBkYXRhIGxvYWRzXG4gICAgICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgICAgICBpZiAoY291cnNlRGF0YSAmJiAhYWN0aXZlS2V5KSB7XG4gICAgICAgICAgaWYgKGNvdXJzZURhdGEuRnJvbnRQYWdlKSB7XG4gICAgICAgICAgICBuYXZpZ2F0ZVRvU2VjdGlvbihcImZyb250cGFnZVwiKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGVsZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIG5hdmlnYXRlVG9TZWN0aW9uKGVsZW1lbnRzWzBdLmtleSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LCBbY291cnNlRGF0YSwgZWxlbWVudHMsIGFjdGl2ZUtleV0pO1xuXG4gICAgICAvLyBGaW5kIHNlbGVjdGVkIGFzc2lnbm1lbnQgb2JqZWN0IGlmIHZpZXdpbmcgb25lXG4gICAgICBjb25zdCBjdXJyZW50QXNzaWdubWVudCA9IFJlYWN0LnVzZU1lbW8oKCkgPT4ge1xuICAgICAgICBpZiAoIXNlbGVjdGVkQXNzaWdubWVudElkIHx8ICFjb3Vyc2VEYXRhPy5Bc3NpZ25tZW50cykgcmV0dXJuIG51bGw7XG4gICAgICAgIGNvbnN0IGxpc3QgPSBBcnJheS5pc0FycmF5KGNvdXJzZURhdGEuQXNzaWdubWVudHMpID8gY291cnNlRGF0YS5Bc3NpZ25tZW50cyA6IE9iamVjdC52YWx1ZXMoY291cnNlRGF0YS5Bc3NpZ25tZW50cyk7XG4gICAgICAgIHJldHVybiBsaXN0LmZpbmQoKGEpID0+IFN0cmluZyhhLmlkKSA9PT0gU3RyaW5nKHNlbGVjdGVkQXNzaWdubWVudElkKSk7XG4gICAgICB9LCBbc2VsZWN0ZWRBc3NpZ25tZW50SWQsIGNvdXJzZURhdGFdKTtcblxuICAgICAgLy8gRmluZCBzZWxlY3RlZCBwYWdlIG9iamVjdCBpZiB2aWV3aW5nIG9uZVxuICAgICAgY29uc3QgY3VycmVudFBhZ2UgPSBSZWFjdC51c2VNZW1vKCgpID0+IHtcbiAgICAgICAgaWYgKCFzZWxlY3RlZFBhZ2VVcmwgfHwgIWNvdXJzZURhdGE/LlBhZ2VzKSByZXR1cm4gbnVsbDtcbiAgICAgICAgY29uc3QgbGlzdCA9IEFycmF5LmlzQXJyYXkoY291cnNlRGF0YS5QYWdlcykgPyBjb3Vyc2VEYXRhLlBhZ2VzIDogT2JqZWN0LnZhbHVlcyhjb3Vyc2VEYXRhLlBhZ2VzKTtcbiAgICAgICAgcmV0dXJuIGxpc3QuZmluZChcbiAgICAgICAgICAocCkgPT5cbiAgICAgICAgICAgIFN0cmluZyhwLnVybCkgPT09IFN0cmluZyhzZWxlY3RlZFBhZ2VVcmwpIHx8XG4gICAgICAgICAgICBTdHJpbmcocC5wYWdlX2lkKSA9PT0gU3RyaW5nKHNlbGVjdGVkUGFnZVVybCkgfHxcbiAgICAgICAgICAgIFN0cmluZyhwLmlkKSA9PT0gU3RyaW5nKHNlbGVjdGVkUGFnZVVybCksXG4gICAgICAgICk7XG4gICAgICB9LCBbc2VsZWN0ZWRQYWdlVXJsLCBjb3Vyc2VEYXRhXSk7XG5cbiAgICAgIC8vIER5bmFtaWMgYnJlYWRjcnVtYnMgYmFzZWQgb24gbmF2aWdhdGlvbiBzdGF0ZSwgbmV2ZXIgc2hvdyBicmVhZGNydW1iIGZvciBmcm9udHBhZ2VcbiAgICAgIGNvbnN0IGJyZWFkY3J1bWJMaXN0ID0gUmVhY3QudXNlTWVtbygoKSA9PiB7XG4gICAgICAgIGNvbnN0IGNydW1icyA9IFtdO1xuICAgICAgICBpZiAoYWN0aXZlS2V5ID09PSBcImFzc2lnbm1lbnRzXCIpIHtcbiAgICAgICAgICBjcnVtYnMucHVzaCh7XG4gICAgICAgICAgICB0aXRsZTogXCJBc3NpZ25tZW50c1wiLFxuICAgICAgICAgICAgY2FsbGJhY2s6ICgpID0+IG5hdmlnYXRlVG9TZWN0aW9uKFwiYXNzaWdubWVudHNcIiksXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKGN1cnJlbnRBc3NpZ25tZW50KSB7XG4gICAgICAgICAgICBjcnVtYnMucHVzaCh7IHRpdGxlOiBjdXJyZW50QXNzaWdubWVudC5uYW1lIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChhY3RpdmVLZXkgPT09IFwicGFnZXNcIikge1xuICAgICAgICAgIGNydW1icy5wdXNoKHtcbiAgICAgICAgICAgIHRpdGxlOiBcIlBhZ2VzXCIsXG4gICAgICAgICAgICBjYWxsYmFjazogKCkgPT4gbmF2aWdhdGVUb1NlY3Rpb24oXCJwYWdlc1wiKSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpZiAoY3VycmVudFBhZ2UpIHtcbiAgICAgICAgICAgIGNydW1icy5wdXNoKHsgdGl0bGU6IGN1cnJlbnRQYWdlLnRpdGxlIHx8IFwiUGFnZSBEZXRhaWxzXCIgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGFjdGl2ZUtleSA9PT0gXCJmcm9udHBhZ2VcIikge1xuICAgICAgICAgIHJldHVybiBjcnVtYnM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY3J1bWJzLnB1c2goe1xuICAgICAgICAgICAgdGl0bGU6IGFjdGl2ZUtleS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIGFjdGl2ZUtleS5zbGljZSgxKSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY3J1bWJzO1xuICAgICAgfSwgW2FjdGl2ZUtleSwgY3VycmVudEFzc2lnbm1lbnQsIGN1cnJlbnRQYWdlXSk7XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8bWFpbiBzdHlsZT17eyBtYXJnaW5MZWZ0OiBcIjBweFwiLCB3aWR0aDogXCIxMDAlXCIgfX0+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9J3RvcC1uYXYnPlxuICAgICAgICAgICAgPGJ1dHRvbiBpZD0nY291cnNlTWVudVRvZ2dsZScgb25DbGljaz17KCkgPT4gc2V0U2hvd0NvdXJzZUxpc3QoIXNob3dDb3Vyc2VMaXN0KX0+XG4gICAgICAgICAgICAgIDxzdmcgd2lkdGg9JzI0JyBoZWlnaHQ9JzI0JyB2aWV3Qm94PScwIDAgMjQgMjQnIGZpbGw9J25vbmUnIHN0cm9rZT0nY3VycmVudENvbG9yJyBzdHJva2VXaWR0aD0nMicgc3Ryb2tlTGluZWNhcD0ncm91bmQnPlxuICAgICAgICAgICAgICAgIDxsaW5lIHgxPSczJyB5MT0nMTInIHgyPScyMScgeTI9JzEyJz48L2xpbmU+XG4gICAgICAgICAgICAgICAgPGxpbmUgeDE9JzMnIHkxPSc2JyB4Mj0nMjEnIHkyPSc2Jz48L2xpbmU+XG4gICAgICAgICAgICAgICAgPGxpbmUgeDE9JzMnIHkxPScxOCcgeDI9JzIxJyB5Mj0nMTgnPjwvbGluZT5cbiAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgIDxUb3BCcmVhZGNydW1icyBsaXN0PXticmVhZGNydW1iTGlzdH0gLz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICBjbGFzc05hbWU9J2JvdHRvbV9zZWN0aW9uJ1xuICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsXG4gICAgICAgICAgICAgIGZsZXhEaXJlY3Rpb246IFwicm93XCIsXG4gICAgICAgICAgICAgIGFsaWduSXRlbXM6IFwiZmxleC1zdGFydFwiLCAvLyBQcmV2ZW50cyBmdWxsLWhlaWdodCBzdHJldGNoaW5nIHNvIHN0aWNraW5lc3Mgd29ya3NcbiAgICAgICAgICAgICAgbWFyZ2luUmlnaHQ6IFwiMjBweFwiLFxuICAgICAgICAgICAgICBtYXJnaW5MZWZ0OiBcIjIwcHhcIixcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgPlxuICAgICAgICAgICAge3Nob3dDb3Vyc2VMaXN0ICYmIDxDb3Vyc2VMaXN0IGVsZW1lbnRzPXtlbGVtZW50c30gYWN0aXZlS2V5PXthY3RpdmVLZXl9IGNhbGxiYWNrPXsoa2V5KSA9PiBuYXZpZ2F0ZVRvU2VjdGlvbihrZXkpfSAvPn1cbiAgICAgICAgICAgIHtyZW5kZXJBY3RpdmVDb250ZW50KGFjdGl2ZUtleSwgY3VycmVudEFzc2lnbm1lbnQsIGN1cnJlbnRQYWdlLCBzZWxlY3RlZERpc2N1c3Npb25JZCwgc2VsZWN0ZWRBbm5vdW5jZW1lbnRJZCl9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvbWFpbj5cbiAgICAgICk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFN3aXRjaCBzdGF0ZW1lbnQgdG8gcmVuZGVyIHRoZSBhcHByb3ByaWF0ZSBjb250ZW50IGJhc2VkIG9uIHRoZSBhY3RpdmVLZXkuIEl0IGN1cnJlbnRseSBoYW5kbGVzIHRoZSBcImZyb250UGFnZVwiIGNhc2UgYW5kIGEgZGVmYXVsdCBjYXNlIGZvciBvdGhlciBrZXlzLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHJlbmRlckFjdGl2ZUNvbnRlbnQoYWN0aXZlS2V5LCBjdXJyZW50QXNzaWdubWVudCwgY3VycmVudFBhZ2UsIHNlbGVjdGVkRGlzY3Vzc2lvbklkLCBzZWxlY3RlZEFubm91bmNlbWVudElkKSB7XG4gICAgICBzd2l0Y2ggKGFjdGl2ZUtleSkge1xuICAgICAgICBjYXNlIFwiYXNzaWdubWVudHNcIjpcbiAgICAgICAgICByZXR1cm4gY3VycmVudEFzc2lnbm1lbnQgPyA8QXNzaWdubWVudERldGFpbFZpZXcgYXNzaWdubWVudD17Y3VycmVudEFzc2lnbm1lbnR9IC8+IDogPEFzc2lnbm1lbnRzUGFnZSAvPjtcbiAgICAgICAgY2FzZSBcImdyYWRlc1wiOlxuICAgICAgICAgIHJldHVybiA8R3JhZGVzUGFnZSAvPjtcbiAgICAgICAgY2FzZSBcIm1vZHVsZXNcIjpcbiAgICAgICAgICByZXR1cm4gPE1vZHVsZXNQYWdlIC8+O1xuICAgICAgICBjYXNlIFwicGFnZXNcIjpcbiAgICAgICAgICByZXR1cm4gY3VycmVudFBhZ2UgPyA8UGFnZURldGFpbFZpZXcgcGFnZT17Y3VycmVudFBhZ2V9IC8+IDogPFBhZ2VzUGFnZSAvPjtcbiAgICAgICAgY2FzZSBcImZpbGVzXCI6XG4gICAgICAgICAgcmV0dXJuIDxGaWxlc1BhZ2UgLz47XG4gICAgICAgIGNhc2UgXCJkaXNjdXNzaW9uc1wiOlxuICAgICAgICAgIHJldHVybiBzZWxlY3RlZERpc2N1c3Npb25JZCA/IDxEaXNjdXNzaW9uRGV0YWlsVmlldyBkaXNjdXNzaW9uSWQ9e3NlbGVjdGVkRGlzY3Vzc2lvbklkfSAvPiA6IDxEaXNjdXNzaW9uc1BhZ2UgLz47XG4gICAgICAgIGNhc2UgXCJhbm5vdW5jZW1lbnRzXCI6XG4gICAgICAgICAgcmV0dXJuIHNlbGVjdGVkQW5ub3VuY2VtZW50SWQgPyA8QW5ub3VuY2VtZW50RGV0YWlsUGFnZSAvPiA6IDxBbm5vdW5jZW1lbnRzUGFnZSAvPjtcbiAgICAgICAgY2FzZSBcImZyb250cGFnZVwiOlxuICAgICAgICAgIHJldHVybiA8SG9tZVBhZ2UgLz47XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSdjYW52YXNfY29udGVudCc+XG4gICAgICAgICAgICAgIFdlIGFyZSBzb3JyeSwgYnV0IHRoZSBzZWN0aW9uIHlvdSBhcmUgdHJ5aW5nIHRvIHZpc2l0IGhhcyBlaXRoZXIgbm90IGJlZW4gaW1wbGVtZW5lbnRlZCBvciB0aGVyZSBpcyBhIHByb2JsZW0gd2l0aCB0aGUgY291cnNlIGRhdGEuXG4gICAgICAgICAgICAgIDxoMT5BY3RpdmUga2V5OiB7YWN0aXZlS2V5fTwvaDE+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0iLCIvKipcbiAqIFxuICogQHJldHVybnMgVGhlIG1haW4gdmlld2VyXG4gKi9cbmZ1bmN0aW9uIE1vZHVsZXNQYWdlKCkge1xuICBjb25zdCB7IGNvdXJzZURhdGEgfSA9IHVzZUNvdXJzZUNvbnRleHQoKTtcbiAgY29uc3QgeyB1c2VTdGF0ZSwgdXNlTWVtbyB9ID0gUmVhY3Q7XG4gIGlmICghY291cnNlRGF0YSkge1xuICAgIHJldHVybiA8ZGl2PkxvYWRpbmcuLi48L2Rpdj47XG4gIH1cbiAgaWYgKCFjb3Vyc2VEYXRhLk1vZHVsZXMpIHtcbiAgICByZXR1cm4gPGRpdj5ObyBtb2R1bGVzIGF2YWlsYWJsZS48L2Rpdj47XG4gIH1cbiAgLy8gQ29udmVydCBkaWN0aW9uYXJ5IG9iamVjdCBvciBhcnJheSBpbnRvIGEgZmxhdCBhcnJheSBvZiBtb2R1bGVzXG4gIGNvbnN0IG1vZHVsZUxpc3QgPSBBcnJheS5pc0FycmF5KGNvdXJzZURhdGEuTW9kdWxlcykgPyBjb3Vyc2VEYXRhLk1vZHVsZXMgOiBPYmplY3QudmFsdWVzKGNvdXJzZURhdGEuTW9kdWxlcyk7XG5cbiAgY29uc3QgW29wZW5TdGF0ZXMsIHNldE9wZW5TdGF0ZXNdID0gdXNlU3RhdGUoKCkgPT4ge1xuICAgIGNvbnN0IGluaXRpYWwgPSB7fTtcbiAgICBtb2R1bGVMaXN0LmZvckVhY2goKG0pID0+IHtcbiAgICAgIGluaXRpYWxbbS5pZF0gPSB0cnVlO1xuICAgIH0pO1xuICAgIHJldHVybiBpbml0aWFsO1xuICB9KTtcbiAgLy8gRGVyaXZlZCBzdGF0ZTogSWYgQVQgTEVBU1QgT05FIG1vZHVsZSBpcyBvcGVuLCBidXR0b24gYWN0aW9uIGlzIFwiQ29sbGFwc2UgQWxsXCIuXG4gIC8vIElmIEFMTCBtb2R1bGVzIGFyZSBjb2xsYXBzZWQgKG5vbmUgYXJlIG9wZW4pLCBidXR0b24gYWN0aW9uIGlzIFwiRXhwYW5kIEFsbFwiLlxuICBjb25zdCBpc0FueU9wZW4gPSB1c2VNZW1vKCgpID0+IHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyhvcGVuU3RhdGVzKS5zb21lKChpc09wZW4pID0+IGlzT3BlbiA9PT0gdHJ1ZSk7XG4gIH0sIFtvcGVuU3RhdGVzXSk7XG5cbiAgLy8gVG9nZ2xlIGluZGl2aWR1YWwgbW9kdWxlIGhlYWRlciBjbGlja1xuICBjb25zdCBoYW5kbGVUb2dnbGVNb2R1bGUgPSAoaWQpID0+IHtcbiAgICBzZXRPcGVuU3RhdGVzKChwcmV2KSA9PiAoe1xuICAgICAgLi4ucHJldixcbiAgICAgIFtpZF06ICFwcmV2W2lkXSxcbiAgICB9KSk7XG4gIH07XG5cbiAgLy8gTWFzdGVyIGJ1dHRvbiB0b2dnbGUgaGFuZGxlclxuICBjb25zdCBoYW5kbGVNYXN0ZXJUb2dnbGUgPSAoKSA9PiB7XG4gICAgY29uc3QgbmV4dFN0YXRlID0gIWlzQW55T3BlbjsgLy8gSWYgYW55IG9wZW4gLT4gaGlkZSBhbGwgKGZhbHNlKTsgaWYgYWxsIGNsb3NlZCAtPiBleHBhbmQgYWxsICh0cnVlKVxuICAgIGNvbnN0IHVwZGF0ZWQgPSB7fTtcbiAgICBtb2R1bGVMaXN0LmZvckVhY2goKG0pID0+IHtcbiAgICAgIHVwZGF0ZWRbbS5pZF0gPSBuZXh0U3RhdGU7XG4gICAgfSk7XG4gICAgc2V0T3BlblN0YXRlcyh1cGRhdGVkKTtcbiAgfTtcbiAgY29uc3QgaGFuZGxlSXRlbVR5cGUgPSAoaXRlbSkgPT4ge1xuICAgIGlmICghaXRlbSB8fCAhaXRlbS50eXBlKSByZXR1cm4gXCJhc3NpZ25tZW50XCI7IC8vIERlZmF1bHQgdG8gYXNzaWdubWVudCBpZiB0eXBlIGlzIG1pc3NpbmdcbiAgICBpZiAoaXRlbT8ucXVpel9sdGkgJiYgaXRlbT8ucXVpel9sdGkgPT0gdHJ1ZSkge1xuICAgICAgcmV0dXJuIFwicXVpelwiO1xuICAgIH1cbiAgICByZXR1cm4gaXRlbS50eXBlLnRvTG93ZXJDYXNlKCk7IC8vIFJldHVybiB0aGUgdHlwZSBpbiBsb3dlcmNhc2UgZm9yIGNvbnNpc3RlbmN5XG4gIH07XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICBjbGFzc05hbWU9J3BhZ2UtZGl2J1xuICAgICAgc3R5bGU9e3tcbiAgICAgICAgbWFyZ2luQm90dG9tOiBcIjRlbVwiLFxuICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIixcbiAgICAgIH19XG4gICAgPlxuICAgICAgPGRpdlxuICAgICAgICBzdHlsZT17e1xuICAgICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICAgIGp1c3RpZnlDb250ZW50OiBcInNwYWNlLWJldHdlZW5cIixcbiAgICAgICAgICBhbGlnbkl0ZW1zOiBcImNlbnRlclwiLFxuICAgICAgICB9fVxuICAgICAgPlxuICAgICAgICA8aDEgc3R5bGU9e3sgY29sb3I6IFwiIzY2NjY2NlwiLCBmb250U2l6ZTogMjguOCB9fT5Nb2R1bGVzPC9oMT5cbiAgICAgICAgPGJ1dHRvblxuICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZU1hc3RlclRvZ2dsZX1cbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcIiNmMmY0ZjRcIixcbiAgICAgICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgI2U4ZWFlY1wiLFxuICAgICAgICAgICAgcGFkZGluZzogXCI4cHggMTRweCA4cHggMTRweFwiLFxuICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiBcIjNweFwiLFxuICAgICAgICAgICAgY3Vyc29yOiBcInBvaW50ZXJcIixcbiAgICAgICAgICAgIGZvbnRTaXplOiBcIjE2cHhcIixcbiAgICAgICAgICAgIGNvbG9yOiBcIiMyNzM1NDBcIixcbiAgICAgICAgICB9fVxuICAgICAgICA+XG4gICAgICAgICAge2lzQW55T3BlbiA/IFwiQ29sbGFwc2UgQWxsXCIgOiBcIkV4cGFuZCBBbGxcIn1cbiAgICAgICAgPC9idXR0b24+XG4gICAgICA8L2Rpdj5cbiAgICAgIHttb2R1bGVMaXN0Lm1hcCgobW9kdWxlLCBpbmRleCkgPT4gKFxuICAgICAgICA8Q29sbGFwc2VUYWJsZVxuICAgICAgICAgIHRpdGxlPXttb2R1bGUubmFtZX1cbiAgICAgICAgICBzdHlsZT17eyBtYXJnaW5Cb3R0b206IFwiNGVtXCIgfX1cbiAgICAgICAgICBrZXk9e21vZHVsZS5pZH1cbiAgICAgICAgICBpc01vZHVsZUl0ZW09e3RydWV9XG4gICAgICAgICAgaXNPcGVuPXtvcGVuU3RhdGVzW21vZHVsZS5pZF0gPz8gdHJ1ZX1cbiAgICAgICAgICBvblRvZ2dsZT17KCkgPT4gaGFuZGxlVG9nZ2xlTW9kdWxlKG1vZHVsZS5pZCl9XG4gICAgICAgID5cbiAgICAgICAgICB7bW9kdWxlLml0ZW1zLm1hcCgoaXRlbSwgaXRlbUluZGV4KSA9PiAoXG4gICAgICAgICAgICA8Q29sbGFwc2VMaXN0SXRlbURldGFpbHNcbiAgICAgICAgICAgICAga2V5PXtpdGVtLmlkfVxuICAgICAgICAgICAgICBjbG9zZWQ9e2l0ZW0/LmF2YWlsYWJpbGl0eV9zdGF0dXM/LnN0YXR1cyB8fCBcIlVua25vd25cIn0gLy8gVXNlcyAnYXZhaWxhYmlsaXR5X3N0YXR1cy5zdGF0dXMnIGZyb20gQ2FudmFzIEpTT05cbiAgICAgICAgICAgICAgdGl0bGU9e2l0ZW0/LnRpdGxlIHx8IFwiTm8gVGl0bGVcIn0gLy8gVXNlcyAndGl0bGUnIGZyb20gQ2FudmFzIEpTT05cbiAgICAgICAgICAgICAgZHVlRGF0ZT17aXRlbT8uZHVlX2F0ID8gZml4RGF0ZUZvcm1hdChpdGVtPy5kdWVfYXQpIDogXCJObyBEdWUgRGF0ZVwifVxuICAgICAgICAgICAgICBncmFkZT17aXRlbT8uc3VibWlzc2lvbj8uc2NvcmUgfHwgXCItXCJ9XG4gICAgICAgICAgICAgIG1heEdyYWRlPXtpdGVtPy5wb2ludHNfcG9zc2libGV9IC8vIFVzZXMgJ3BvaW50c19wb3NzaWJsZScgZnJvbSBDYW52YXMgSlNPTlxuICAgICAgICAgICAgICB0eXBlPXtoYW5kbGVJdGVtVHlwZShpdGVtKX0gLy8gVXNlcyAndHlwZScgZnJvbSBDYW52YXMgSlNPTiwgY29udmVydGVkIHRvIGxvd2VyY2FzZVxuICAgICAgICAgICAgICBhc3NpZ25tZW50PXtpdGVtLnR5cGUgPT0gXCJBc3NpZ25tZW50XCIgPyBpdGVtIDogdW5kZWZpbmVkfVxuICAgICAgICAgICAgICBwYWdlVXJsPXtpdGVtLnR5cGUgPT0gXCJQYWdlXCIgPyBpdGVtLnBhZ2VfdXJsIHx8IGl0ZW0udXJsIDogdW5kZWZpbmVkfVxuICAgICAgICAgICAgICBpc01vZHVsZUl0ZW09e3RydWV9XG4gICAgICAgICAgICAgIGluZGVudD17aXRlbT8uaW5kZW50ID8/IDB9IC8vIFVzZXMgJ2luZGVudCcgZnJvbSBDYW52YXMgSlNPTiB0byBkZXRlcm1pbmUgdGhlIGluZGVudGF0aW9uIGxldmVsIG9mIHRoZSBtb2R1bGUgaXRlbVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICApKX1cbiAgICAgICAgPC9Db2xsYXBzZVRhYmxlPlxuICAgICAgKSl9XG4gICAgPC9kaXY+XG4gICk7XG59XG4iLCIvKipcbiAqIENhbnZhcy1lc3F1ZSBuYW1lIHByb2ZpbGUgY2FyZFxuICogQHBhcmFtIHtPYmplY3R9IHByb3BzXG4gKiBAcGFyYW0ge3N0cmluZ30gcHJvcHMubmFtZSAtIFRoZSBuYW1lIHRvIGRpc3BsYXlcbiAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wcy5kYXRlIC0gVGhlIGRhdGUgdG8gZGlzcGxheVxuICogQHBhcmFtIHtib29sZWFufSBwcm9wcy5pbmNsdWRlUHJvZmlsZUNpcmNsZSAtIFdoZXRoZXIgdG8gaW5jbHVkZSB0aGUgcHJvZmlsZSBjaXJjbGVcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gcHJvcHMuaW5jbHVkZU5hbWUgLSBXaGV0aGVyIHRvIGluY2x1ZGUgdGhlIG5hbWVcbiAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wcy5uYW1lU3R5bGUgLSBUaGUgc3R5bGUgdG8gYXBwbHkgdG8gdGhlIG5hbWUgKGFuZCBkYXRlKVxuICogQHJldHVybnMge1JlYWN0LkNvbXBvbmVudH0gVGhlIG5hbWUgcHJvZmlsZSBjYXJkXG4gKi9cbmZ1bmN0aW9uIE5hbWVQcm9maWxlQ2FyZCh7IG5hbWUsIGRhdGUsIGluY2x1ZGVQcm9maWxlQ2lyY2xlID0gdHJ1ZSwgaW5jbHVkZU5hbWUgPSB0cnVlLCBuYW1lU3R5bGUgfSkge1xuICBsZXQgaW5pdGlhbHMgPSBuYW1lXG4gICAgLnNwbGl0KFwiIFwiKVxuICAgIC5tYXAoKG5hbWUpID0+IG5hbWVbMF0pXG4gICAgLmpvaW4oXCJcIik7XG4gIGluaXRpYWxzID0gaW5pdGlhbHMudG9VcHBlckNhc2UoKTtcbiAgbGV0IGRhdGVTdHJpbmcgPSBcIi1cIjtcbiAgaWYgKGRhdGUpIHtcbiAgICBkYXRlU3RyaW5nID0gZml4RGF0ZUZvcm1hdChkYXRlKTtcbiAgfVxuICByZXR1cm4gKFxuICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogXCJmbGV4XCIsIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsIGdhcDogXCIxZW1cIiB9fT5cbiAgICAgIHtpbmNsdWRlUHJvZmlsZUNpcmNsZSAmJiAoXG4gICAgICAgIDxkaXZcbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgYm9yZGVyOiBcIjJweCBzb2xpZCByZ2IoMTQxLCAxNDksIDE1OSlcIixcbiAgICAgICAgICAgIGNvbG9yOiBcInJnYig0MywgMTIyLCAxODgpXCIsXG4gICAgICAgICAgICBmb250V2VpZ2h0OiBcIjcwMFwiLFxuICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiBcIjUwJVwiLFxuICAgICAgICAgICAgbWluSGVpZ2h0OiBcIjUwcHhcIixcbiAgICAgICAgICAgIG1pbldpZHRoOiBcIjUwcHhcIixcbiAgICAgICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICAgICAganVzdGlmeUNvbnRlbnQ6IFwiY2VudGVyXCIsXG4gICAgICAgICAgICBhbGlnbkl0ZW1zOiBcImNlbnRlclwiLFxuICAgICAgICAgICAgZm9udFNpemU6IFwiMS4yNSByZW1cIixcbiAgICAgICAgICB9fVxuICAgICAgICA+XG4gICAgICAgICAge2luaXRpYWxzfVxuICAgICAgICA8L2Rpdj5cbiAgICAgICl9XG4gICAgICB7aW5jbHVkZU5hbWUgJiYgKFxuICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6IFwiZmxleFwiLCBmbGV4RGlyZWN0aW9uOiBcImNvbHVtblwiLCAuLi5uYW1lU3R5bGUgfX0+XG4gICAgICAgICAgPHNwYW4gc3R5bGU9e3sgZm9udFdlaWdodDogXCJib2xkXCIgfX0+e25hbWV9PC9zcGFuPlxuICAgICAgICAgIDxzcGFuIHN0eWxlPXt7IGNvbG9yOiBcInJnYig5OSwgMTA5LCAxMTcpXCIgfX0+e2RhdGVTdHJpbmd9PC9zcGFuPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICl9XG4gICAgPC9kaXY+XG4gICk7XG59XG4iLCIvKipcbiAqIFJlbmRlcnMgdGhlIHBhZ2Ugc2VsZWN0ZWQgYnkgdGhlIHVzZXIgdXNpbmcgX2Rhbmdlcm91c2x5U2V0SW5uZXJIVE1MXG4gKiBAcGFyYW0ge09iamVjdH0gcGFnZSAtIFRoZSBwYWdlIG9iamVjdCBmcm9tIHRoZSBjb3Vyc2UgZGF0YVxuICogQHJldHVybnMge1JlYWN0LkNvbXBvbmVudH0gVGhlIHBhZ2UgZGV0YWlsIHZpZXdcbiAqL1xuZnVuY3Rpb24gUGFnZURldGFpbFZpZXcoeyBwYWdlIH0pIHtcbiAgY29uc3QgeyBkaXJIYW5kbGUgfSA9IHVzZUNvdXJzZUNvbnRleHQoKTtcbiAgY29uc3QgW2JvZHlIdG1sLCBzZXRCb2R5SHRtbF0gPSB1c2VTdGF0ZShwYWdlPy5ib2R5IHx8IG51bGwpO1xuICBjb25zdCBbaXNMb2FkaW5nLCBzZXRJc0xvYWRpbmddID0gdXNlU3RhdGUoIXBhZ2U/LmJvZHkpO1xuICBjb25zdCBbZXJyb3IsIHNldEVycm9yXSA9IHVzZVN0YXRlKG51bGwpO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgbGV0IGlzTW91bnRlZCA9IHRydWU7XG5cbiAgICBhc3luYyBmdW5jdGlvbiBsb2FkUGFnZUJvZHkoKSB7XG4gICAgICBpZiAocGFnZT8uYm9keSkge1xuICAgICAgICBzZXRCb2R5SHRtbChwYWdlLmJvZHkpO1xuICAgICAgICBzZXRJc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICghZGlySGFuZGxlKSB7XG4gICAgICAgIHNldElzTG9hZGluZyhmYWxzZSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgc2V0SXNMb2FkaW5nKHRydWUpO1xuICAgICAgICBzZXRFcnJvcihudWxsKTtcblxuICAgICAgICBsZXQgcGFnZXNIYW5kbGUgPSBudWxsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHBhZ2VzSGFuZGxlID0gYXdhaXQgZGlySGFuZGxlLmdldERpcmVjdG9yeUhhbmRsZShcIlBhZ2VzXCIpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oXCJQYWdlcyBkaXJlY3RvcnkgaGFuZGxlIG5vdCBmb3VuZDpcIiwgZXJyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghcGFnZXNIYW5kbGUpIHtcbiAgICAgICAgICBpZiAoaXNNb3VudGVkKSB7XG4gICAgICAgICAgICBzZXRFcnJvcihcIlBhZ2VzIGZvbGRlciBub3QgZm91bmQgbG9jYWxseS5cIik7XG4gICAgICAgICAgICBzZXRJc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB0YXJnZXRVcmxSYXcgPSAocGFnZS51cmwgfHwgcGFnZS50aXRsZSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcbiAgICAgICAgY29uc3QgdGFyZ2V0VXJsU2FuaXRpemVkID0gc2FuaXRpemVGaWxlbmFtZShwYWdlLnVybCB8fCBwYWdlLnRpdGxlIHx8IFwiXCIpXG4gICAgICAgICAgLnRvTG93ZXJDYXNlKClcbiAgICAgICAgICAudHJpbSgpO1xuICAgICAgICBsZXQgbWF0Y2hlZEZpbGVIYW5kbGUgPSBudWxsO1xuXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgZW50cnkgb2YgcGFnZXNIYW5kbGUudmFsdWVzKCkpIHtcbiAgICAgICAgICBpZiAoZW50cnkua2luZCA9PT0gXCJmaWxlXCIgJiYgKGVudHJ5Lm5hbWUuZW5kc1dpdGgoXCIuaHRtbFwiKSB8fCBlbnRyeS5uYW1lLmVuZHNXaXRoKFwiLmh0bVwiKSkpIHtcbiAgICAgICAgICAgIGNvbnN0IG5hbWVXaXRob3V0RXh0ID0gZW50cnkubmFtZVxuICAgICAgICAgICAgICAucmVwbGFjZSgvXFwuaHRtbD8kL2ksIFwiXCIpXG4gICAgICAgICAgICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgICAgICAgICAgIC50cmltKCk7XG4gICAgICAgICAgICBjb25zdCBuYW1lU2FuaXRpemVkID0gc2FuaXRpemVGaWxlbmFtZShuYW1lV2l0aG91dEV4dCkudG9Mb3dlckNhc2UoKS50cmltKCk7XG5cbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgbmFtZVdpdGhvdXRFeHQgPT09IHRhcmdldFVybFJhdyB8fFxuICAgICAgICAgICAgICBuYW1lU2FuaXRpemVkID09PSB0YXJnZXRVcmxTYW5pdGl6ZWQgfHxcbiAgICAgICAgICAgICAgbmFtZVdpdGhvdXRFeHQuaW5jbHVkZXModGFyZ2V0VXJsU2FuaXRpemVkKSB8fFxuICAgICAgICAgICAgICB0YXJnZXRVcmxTYW5pdGl6ZWQuaW5jbHVkZXMobmFtZVNhbml0aXplZClcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICBtYXRjaGVkRmlsZUhhbmRsZSA9IGVudHJ5O1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWF0Y2hlZEZpbGVIYW5kbGUpIHtcbiAgICAgICAgICBjb25zdCBmaWxlID0gYXdhaXQgbWF0Y2hlZEZpbGVIYW5kbGUuZ2V0RmlsZSgpO1xuICAgICAgICAgIGNvbnN0IHRleHQgPSBhd2FpdCBmaWxlLnRleHQoKTtcbiAgICAgICAgICBpZiAoaXNNb3VudGVkKSB7XG4gICAgICAgICAgICBzZXRCb2R5SHRtbCh0ZXh0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKGlzTW91bnRlZCkge1xuICAgICAgICAgICAgc2V0RXJyb3IoXCJQYWdlIGNvbnRlbnQgZmlsZSBub3QgZm91bmQgbG9jYWxseS5cIik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIHJlYWRpbmcgbG9jYWwgcGFnZSBmaWxlOlwiLCBlcnIpO1xuICAgICAgICBpZiAoaXNNb3VudGVkKSB7XG4gICAgICAgICAgc2V0RXJyb3IoXCJGYWlsZWQgdG8gbG9hZCBwYWdlIGNvbnRlbnQuXCIpO1xuICAgICAgICB9XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBpZiAoaXNNb3VudGVkKSB7XG4gICAgICAgICAgc2V0SXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGxvYWRQYWdlQm9keSgpO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBpc01vdW50ZWQgPSBmYWxzZTtcbiAgICB9O1xuICB9LCBbcGFnZSwgZGlySGFuZGxlXSk7XG5cbiAgaWYgKCFwYWdlKSB7XG4gICAgcmV0dXJuIDxoMT5ObyBQYWdlIFNlbGVjdGVkPC9oMT47XG4gIH1cblxuICBmdW5jdGlvbiBjdXN0b21EYXRlRm9ybWF0KGRhdGVTdHIpIHtcbiAgICBpZiAoIWRhdGVTdHIpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IGRhdGVPYmogPSBuZXcgRGF0ZShkYXRlU3RyKTtcbiAgICByZXR1cm4gZGF0ZU9iai50b0xvY2FsZURhdGVTdHJpbmcoXCJlbi1VU1wiLCB7XG4gICAgICB3ZWVrZGF5OiBcInNob3J0XCIsXG4gICAgICBtb250aDogXCJzaG9ydFwiLFxuICAgICAgZGF5OiBcIm51bWVyaWNcIixcbiAgICAgIHllYXI6IFwibnVtZXJpY1wiLFxuICAgICAgaG91cjogXCJudW1lcmljXCIsXG4gICAgICBtaW51dGU6IFwibnVtZXJpY1wiLFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICBzdHlsZT17e1xuICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIixcbiAgICAgICAgd2lkdGg6IFwiMTAwJVwiLFxuICAgICAgICBtYXJnaW5Cb3R0b206IFwiOGVtXCIsXG4gICAgICB9fVxuICAgID5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPSdhc3NpZ25tZW50LXN0dWRlbnQtaGVhZGVyJyBzdHlsZT17eyBib3JkZXJCb3R0b206IFwiMnB4IHNvbGlkICMzOTQ1NGVcIiwgcGFkZGluZ0JvdHRvbTogXCIwLjc1ZW1cIiB9fT5cbiAgICAgICAgPHNwYW4gc3R5bGU9e3sgZGlzcGxheTogXCJmbGV4XCIsIGZsZXhEaXJlY3Rpb246IFwiY29sdW1uXCIgfX0+XG4gICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPSdhc3NpZ25tZW50LXN0dWRlbnQtaGVhZGVyLXRpdGxlJz57cGFnZS50aXRsZX08L3NwYW4+XG4gICAgICAgICAgPHNwYW4gc3R5bGU9e3sgZm9udFNpemU6IFwiMTRweFwiLCBjb2xvcjogXCIjNTU1XCIsIG1hcmdpblRvcDogXCI0cHhcIiB9fT5cbiAgICAgICAgICAgIHtwYWdlLnVwZGF0ZWRfYXRcbiAgICAgICAgICAgICAgPyBgTGFzdCB1cGRhdGVkOiAke2N1c3RvbURhdGVGb3JtYXQocGFnZS51cGRhdGVkX2F0KX1gXG4gICAgICAgICAgICAgIDogcGFnZS5jcmVhdGVkX2F0XG4gICAgICAgICAgICAgICAgPyBgQ3JlYXRlZDogJHtjdXN0b21EYXRlRm9ybWF0KHBhZ2UuY3JlYXRlZF9hdCl9YFxuICAgICAgICAgICAgICAgIDogXCJcIn1cbiAgICAgICAgICA8L3NwYW4+XG4gICAgICAgIDwvc3Bhbj5cbiAgICAgICAge3BhZ2UuZnJvbnRfcGFnZSAmJiAoXG4gICAgICAgICAgPHNwYW5cbiAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogXCIjMDA4NDJjXCIsXG4gICAgICAgICAgICAgIGNvbG9yOiBcIiNmZmZcIixcbiAgICAgICAgICAgICAgcGFkZGluZzogXCI0cHggMTBweFwiLFxuICAgICAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiMTJweFwiLFxuICAgICAgICAgICAgICBmb250U2l6ZTogXCIxMnB4XCIsXG4gICAgICAgICAgICAgIGZvbnRXZWlnaHQ6IFwiYm9sZFwiLFxuICAgICAgICAgICAgICBhbGlnblNlbGY6IFwiY2VudGVyXCIsXG4gICAgICAgICAgICB9fVxuICAgICAgICAgID5cbiAgICAgICAgICAgIEZyb250IFBhZ2VcbiAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICl9XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGRpdiBzdHlsZT17eyBtYXJnaW5Ub3A6IFwiMS41ZW1cIiB9fT5cbiAgICAgICAge2lzTG9hZGluZyAmJiA8ZGl2IHN0eWxlPXt7IGNvbG9yOiBcIiM2NjZcIiwgcGFkZGluZzogXCIxZW1cIiB9fT5Mb2FkaW5nIHBhZ2UgY29udGVudC4uLjwvZGl2Pn1cbiAgICAgICAge2Vycm9yICYmIDxkaXYgc3R5bGU9e3sgY29sb3I6IFwiI2MwMFwiLCBwYWRkaW5nOiBcIjFlbVwiLCBiYWNrZ3JvdW5kQ29sb3I6IFwiI2ZlZVwiLCBib3JkZXJSYWRpdXM6IFwiNHB4XCIgfX0+e2Vycm9yfTwvZGl2Pn1cbiAgICAgICAgeyFpc0xvYWRpbmcgJiYgIWVycm9yICYmIGJvZHlIdG1sICYmIDxkaXYgY2xhc3NOYW1lPSdhc3NpZ25tZW50LWRldGFpbHMnIGRhbmdlcm91c2x5U2V0SW5uZXJIVE1MPXt7IF9faHRtbDogYm9keUh0bWwgfX0gLz59XG4gICAgICAgIHshaXNMb2FkaW5nICYmICFlcnJvciAmJiAhYm9keUh0bWwgJiYgPGRpdiBzdHlsZT17eyBjb2xvcjogXCIjNjY2XCIsIHBhZGRpbmc6IFwiMWVtXCIgfX0+Tm8gY29udGVudCBhdmFpbGFibGUgZm9yIHRoaXMgcGFnZS48L2Rpdj59XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cbiIsIi8qKlxuICogQ3JlYXRlcyB0aGUgbGlzdCBvZiBwYWdlcyBmb3IgdGhlIGNvdXJzZS5cbiAqIEByZXR1cm5zIHtKU1guRWxlbWVudH0gbGlzdCBvZiBwYWdlcyBmb3IgdGhlIGVudGlyZSBjb3Vyc2VcbiAqL1xuZnVuY3Rpb24gUGFnZXNQYWdlKCkge1xuICBjb25zdCB7IGNvdXJzZURhdGEgfSA9IHVzZUNvdXJzZUNvbnRleHQoKTtcbiAgY29uc3QgeyBuYXZpZ2F0ZVRvUGFnZSB9ID0gdXNlTmF2aWdhdGlvbigpO1xuXG4gIGlmICghY291cnNlRGF0YSkge1xuICAgIHJldHVybiA8ZGl2PkxvYWRpbmcuLi48L2Rpdj47XG4gIH1cbiAgaWYgKCFjb3Vyc2VEYXRhLlBhZ2VzIHx8IGNvdXJzZURhdGEuUGFnZXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIDxkaXY+Tm8gcGFnZXMgYXZhaWxhYmxlLjwvZGl2PjtcbiAgfVxuXG4gIGNvbnN0IHBhZ2VzTGlzdCA9IEFycmF5LmlzQXJyYXkoY291cnNlRGF0YS5QYWdlcykgPyBjb3Vyc2VEYXRhLlBhZ2VzIDogT2JqZWN0LnZhbHVlcyhjb3Vyc2VEYXRhLlBhZ2VzKTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgc3R5bGU9e3sgd2lkdGg6IFwiMTAwJVwiLCBtYXJnaW5Cb3R0b206IFwiOGVtXCIgfX0+XG4gICAgICA8aDEgc3R5bGU9e3sgY29sb3I6IFwiIzY2NjY2NlwiLCBmb250U2l6ZTogMjguOCB9fT5QYWdlczwvaDE+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT0ncGFnZXMtY29udGFpbmVyJyBzdHlsZT17eyB3aWR0aDogXCIxMDAlXCIgfX0+XG4gICAgICAgIDx0YWJsZSBjbGFzc05hbWU9J3BhZ2VzLXRhYmxlJyBzdHlsZT17eyB3aWR0aDogXCIxMDAlXCIgfX0+XG4gICAgICAgICAgPHRoZWFkPlxuICAgICAgICAgICAgPHRyIHN0eWxlPXt7IGJvcmRlckJvdHRvbTogXCIycHggc29saWQgcmdiKDM5LCA1MywgNjQpXCIgfX0+XG4gICAgICAgICAgICAgIDx0aCBzdHlsZT17eyBtaW5XaWR0aDogXCJmaXQtY29udGVudFwiLCB3aGl0ZVNwYWNlOiBcIm5vd3JhcFwiIH19PlRpdGxlPC90aD5cbiAgICAgICAgICAgICAgPHRoIHN0eWxlPXt7IG1pbldpZHRoOiBcImZpdC1jb250ZW50XCIsIHdoaXRlU3BhY2U6IFwibm93cmFwXCIgfX0+Q3JlYXRpb24gRGF0ZTwvdGg+XG4gICAgICAgICAgICAgIDx0aCBzdHlsZT17eyBtaW5XaWR0aDogXCJmaXQtY29udGVudFwiLCB3aGl0ZVNwYWNlOiBcIm5vd3JhcFwiIH19PlVwZGF0ZWQgYXQ8L3RoPlxuICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICA8L3RoZWFkPlxuICAgICAgICAgIDx0Ym9keT5cbiAgICAgICAgICAgIHtwYWdlc0xpc3QubWFwKChwYWdlLCBpbmRleCkgPT4gKFxuICAgICAgICAgICAgICA8dHIga2V5PXtwYWdlLnBhZ2VfaWQgfHwgcGFnZS51cmwgfHwgcGFnZS5pZCB8fCBpbmRleH0gc3R5bGU9e3sgYmFja2dyb3VuZENvbG9yOiBpbmRleCAlIDIgPT09IDAgPyBcIiNmMmY0ZjRcIiA6IFwid2hpdGVcIiB9fT5cbiAgICAgICAgICAgICAgICA8dGQ+XG4gICAgICAgICAgICAgICAgICA8YVxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9J2Fzc2lnbm1lbnQtbGluaydcbiAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KGUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgbmF2aWdhdGVUb1BhZ2UocGFnZS51cmwgfHwgcGFnZS5wYWdlX2lkIHx8IHBhZ2UuaWQpO1xuICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICB7cGFnZS50aXRsZX1cbiAgICAgICAgICAgICAgICAgIDwvYT5cbiAgICAgICAgICAgICAgICAgIHtwYWdlLmZyb250X3BhZ2UgJiYgKFxuICAgICAgICAgICAgICAgICAgICA8c3BhblxuICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXJnaW5MZWZ0OiBcIjhweFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgZm9udFNpemU6IFwiMTFweFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcIiMwMDg0MmNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yOiBcIiNmZmZcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhZGRpbmc6IFwiMnB4IDZweFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiBcIjEwcHhcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvbnRXZWlnaHQ6IFwiYm9sZFwiLFxuICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICBGcm9udCBQYWdlXG4gICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICA8dGQgc3R5bGU9e3sgbWluV2lkdGg6IFwiZml0LWNvbnRlbnRcIiwgd2hpdGVTcGFjZTogXCJub3dyYXBcIiB9fT5cbiAgICAgICAgICAgICAgICAgIHtwYWdlLmNyZWF0ZWRfYXRcbiAgICAgICAgICAgICAgICAgICAgPyBuZXcgRGF0ZShwYWdlLmNyZWF0ZWRfYXQpLnRvTG9jYWxlRGF0ZVN0cmluZyhcImVuLVVTXCIsIHsgeWVhcjogXCJudW1lcmljXCIsIG1vbnRoOiBcInNob3J0XCIsIGRheTogXCJudW1lcmljXCIgfSlcbiAgICAgICAgICAgICAgICAgICAgOiBcIi1cIn1cbiAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT17eyBtaW5XaWR0aDogXCJmaXQtY29udGVudFwiLCB3aGl0ZVNwYWNlOiBcIm5vd3JhcFwiIH19PlxuICAgICAgICAgICAgICAgICAge3BhZ2UudXBkYXRlZF9hdFxuICAgICAgICAgICAgICAgICAgICA/IG5ldyBEYXRlKHBhZ2UudXBkYXRlZF9hdCkudG9Mb2NhbGVEYXRlU3RyaW5nKFwiZW4tVVNcIiwgeyB5ZWFyOiBcIm51bWVyaWNcIiwgbW9udGg6IFwic2hvcnRcIiwgZGF5OiBcIm51bWVyaWNcIiB9KVxuICAgICAgICAgICAgICAgICAgICA6IFwiLVwifVxuICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICApKX1cbiAgICAgICAgICA8L3Rib2R5PlxuICAgICAgICA8L3RhYmxlPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59XG4iLCIvKipcbiAqIFJlZm9ybWF0cyBDYW52YXMgZGF0ZSBzdHJpbmdzIHRvIGEgbW9yZSByZWFkYWJsZSBmb3JtYXRcbiAqIEBwYXJhbSB7c3RyaW5nfSBkYXRlU3RyaW5nIC0gVGhlIGRhdGUgc3RyaW5nIHRvIHJlZm9ybWF0XG4gKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgcmVmb3JtYXR0ZWQgZGF0ZSBzdHJpbmdcbiAqL1xuZnVuY3Rpb24gZml4RGF0ZUZvcm1hdChkYXRlU3RyaW5nKSB7XG4gIC8vUmVmb3JtYXRzIENhbnZhcyBkYXRlIHN0cmluZ3MgdG8gYSBtb3JlIHJlYWRhYmxlIGZvcm1hdFxuICAvLyBFeGFtcGxlIGlucHV0OiAyMDIyLTA4LTI5VDIyOjMwOjAwWlxuICAvLyBFeGFtcGxlIG91dHB1dDogSnVuIDcgYXQgMTE6NTlwbVxuICBpZiAoIWRhdGVTdHJpbmcpIHJldHVybiBcIlwiO1xuICBjb25zdCBkYXRlID0gbmV3IERhdGUoZGF0ZVN0cmluZyk7XG4gIGNvbnN0IGRhdGVQYXJ0ID0gZGF0ZS50b0xvY2FsZURhdGVTdHJpbmcoXCJlbi1VU1wiLCB7XG4gICAgbW9udGg6IFwic2hvcnRcIixcbiAgICBkYXk6IFwibnVtZXJpY1wiLFxuICB9KTtcbiAgY29uc3QgdGltZVBhcnQgPSBkYXRlXG4gICAgLnRvTG9jYWxlVGltZVN0cmluZyhcImVuLVVTXCIsIHtcbiAgICAgIGhvdXI6IFwibnVtZXJpY1wiLFxuICAgICAgbWludXRlOiBcIjItZGlnaXRcIixcbiAgICAgIGhvdXIxMjogdHJ1ZSxcbiAgICB9KVxuICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgLnJlcGxhY2UoL1xccysvZywgXCJcIik7IC8vIENvbnZlcnRzIFwiMTA6MzAgUE1cIiAtPiBcIjEwOjMwcG1cIlxuXG4gIHJldHVybiBgJHtkYXRlUGFydH0gYXQgJHt0aW1lUGFydH1gO1xufVxuXG4vKipcbiAqIERldGVjdHMgdGhlIGN1cnJlbnQgZXhlY3V0aW9uIGVudmlyb25tZW50IG9mIHRoZSBhcHBsaWNhdGlvbi5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBjdXJyZW50IGV4ZWN1dGlvbiBlbnZpcm9ubWVudC5cbiAqL1xuZnVuY3Rpb24gZ2V0QXBwQ29udGV4dCgpIHtcbiAgY29uc3QgcHJvdG9jb2wgPSB3aW5kb3cubG9jYXRpb24ucHJvdG9jb2w7XG4gIGNvbnN0IGhvc3RuYW1lID0gd2luZG93LmxvY2F0aW9uLmhvc3RuYW1lO1xuXG4gIC8vIDEuIExvY2FsIEhUTUwgZmlsZSBvcGVuZWQgZGlyZWN0bHkgZnJvbSB0aGUgaGFyZCBkcml2ZVxuICBpZiAocHJvdG9jb2wgPT09IFwiZmlsZTpcIikge1xuICAgIHJldHVybiBcImxvY2FsX2ZpbGVcIjtcbiAgfVxuXG4gIC8vIDIuIFJ1bm5pbmcgaW5zaWRlIGEgYnJvd3NlciBleHRlbnNpb24gKENocm9tZSwgRWRnZSwgQnJhdmUsIE9wZXJhLCBGaXJlZm94KVxuICBpZiAocHJvdG9jb2wgPT09IFwiY2hyb21lLWV4dGVuc2lvbjpcIiB8fCBwcm90b2NvbCA9PT0gXCJtb3otZXh0ZW5zaW9uOlwiKSB7XG4gICAgcmV0dXJuIFwiZXh0ZW5zaW9uXCI7XG4gIH1cblxuICAvLyAzLiBIb3N0ZWQgb24gYSB3ZWIgc2VydmVyXG4gIGlmIChwcm90b2NvbCA9PT0gXCJodHRwOlwiIHx8IHByb3RvY29sID09PSBcImh0dHBzOlwiKSB7XG4gICAgaWYgKGhvc3RuYW1lID09PSBcImxvY2FsaG9zdFwiIHx8IGhvc3RuYW1lID09PSBcIjEyNy4wLjAuMVwiKSB7XG4gICAgICByZXR1cm4gXCJsb2NhbGhvc3RcIjtcbiAgICB9XG4gICAgcmV0dXJuIFwid2Vic2l0ZVwiO1xuICB9XG5cbiAgcmV0dXJuIFwidW5rbm93blwiO1xufVxuXG4vKiogUmVwbGFjZXMgY2hhcmFjdGVycyB0aGF0IGFyZSBpbnZhbGlkIG9yIHByb2JsZW1hdGljIGluIGZpbGUgcGF0aHMuXG4gKiBUYWtlbiBmcm9tIHRoZSBoZWxwZXJzLmpzIGZpbGUuXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgZmlsZSB0byBzYW5pdGl6ZVxuICogQHJldHVybnMge3N0cmluZ30gVGhlIHNhbml0aXplZCBmaWxlbmFtZVxuICovXG5mdW5jdGlvbiBzYW5pdGl6ZUZpbGVuYW1lKG5hbWUpIHtcbiAgaWYgKCFuYW1lKSByZXR1cm4gXCJ1bnRpdGxlZFwiO1xuICBjb25zdCBjbGVhbmVkID0gbmFtZVxuICAgIC5yZXBsYWNlKC9bXFx1MDAwMC1cXHUwMDFGXFx1MDA3Rl0vZywgXCJcIikgLy8gY29udHJvbCBjaGFyc1xuICAgIC5yZXBsYWNlKC9bXFx1MjAwQi1cXHUyMDBEXFx1RkVGRl0vZywgXCJcIikgLy8gemVyby13aWR0aCBjaGFyc1xuICAgIC5yZXBsYWNlKC9cXHUwMEEwL2csIFwiIFwiKSAvLyBub24tYnJlYWtpbmcgc3BhY2VcbiAgICAucmVwbGFjZSgvWy9cXFxcPyUqOnxcIjw+XS9nLCBcIi1cIikgLy8gT1MtcmVzZXJ2ZWQgY2hhcnNcbiAgICAucmVwbGFjZSgvXlxcLisvLCBcIlwiKSAvLyBsZWFkaW5nIGRvdHNcbiAgICAucmVwbGFjZSgvWy4gXSskLywgXCJcIikgLy8gdHJhaWxpbmcgZG90cy9zcGFjZXNcbiAgICAucmVwbGFjZSgvXihDT058UFJOfEFVWHxOVUx8Q09NWzEtOV18TFBUWzEtOV0pKFxcLnwkKS9pLCBcIl8kMSQyXCIpIC8vIFdpbmRvd3MgcmVzZXJ2ZWQgbmFtZXNcbiAgICAudHJpbSgpO1xuICByZXR1cm4gY2xlYW5lZCB8fCBcInVudGl0bGVkXCI7XG59XG5cbi8qKlxuICogRGV0ZWN0cyB0aGUgbWltZSBjbGFzcyBvZiBhIGZpbGUgb2JqZWN0LlxuICogQHBhcmFtIHsqfSBmaWxlT2JqIC0gVGhlIGZpbGUgb2JqZWN0IHRvIGRldGVjdCB0aGUgbWltZSBjbGFzcyBvZi5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBtaW1lIGNsYXNzIG9mIHRoZSBmaWxlIG9iamVjdC5cbiAqL1xuZnVuY3Rpb24gZ2V0TWltZUNsYXNzKGZpbGVPYmopIHtcbiAgaWYgKCFmaWxlT2JqKSByZXR1cm4gXCJ1bmtub3duXCI7XG4gIGlmIChmaWxlT2JqLm1pbWVfY2xhc3MpIHJldHVybiBmaWxlT2JqLm1pbWVfY2xhc3M7XG4gIGNvbnN0IGNvbnRlbnRUeXBlID0gKGZpbGVPYmpbXCJjb250ZW50LXR5cGVcIl0gfHwgZmlsZU9iai5jb250ZW50VHlwZSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBmaWxlbmFtZSA9IChmaWxlT2JqLmRpc3BsYXlfbmFtZSB8fCBmaWxlT2JqLmZpbGVuYW1lIHx8IFwiXCIpLnRvTG93ZXJDYXNlKCk7XG5cbiAgaWYgKGNvbnRlbnRUeXBlLnN0YXJ0c1dpdGgoXCJpbWFnZS9cIikgfHwgL1xcLihqcGd8anBlZ3xwbmd8Z2lmfHN2Z3x3ZWJwfGJtcHxpY28pJC8udGVzdChmaWxlbmFtZSkpIHJldHVybiBcImltYWdlXCI7XG4gIGlmIChjb250ZW50VHlwZS5zdGFydHNXaXRoKFwidmlkZW8vXCIpIHx8IC9cXC4obXA0fHdlYm18b2dnfG1vdnxhdml8bWt2KSQvLnRlc3QoZmlsZW5hbWUpKSByZXR1cm4gXCJ2aWRlb1wiO1xuICBpZiAoY29udGVudFR5cGUgPT09IFwiYXBwbGljYXRpb24vcGRmXCIgfHwgZmlsZW5hbWUuZW5kc1dpdGgoXCIucGRmXCIpKSByZXR1cm4gXCJwZGZcIjtcbiAgaWYgKGNvbnRlbnRUeXBlLnN0YXJ0c1dpdGgoXCJ0ZXh0L1wiKSB8fCAvXFwuKHR4dHxtZHxjc3Z8anNvbnxqc3xweXxjfGNwcHxjc3N8eG1sKSQvLnRlc3QoZmlsZW5hbWUpKSByZXR1cm4gXCJ0ZXh0XCI7XG4gIGlmIChjb250ZW50VHlwZS5pbmNsdWRlcyhcImh0bWxcIikgfHwgL1xcLihodG1sfGh0bSkkLy50ZXN0KGZpbGVuYW1lKSkgcmV0dXJuIFwiaHRtbFwiO1xuICBpZiAoY29udGVudFR5cGUuaW5jbHVkZXMoXCJ3b3JkXCIpIHx8IGNvbnRlbnRUeXBlLmluY2x1ZGVzKFwib2ZmaWNlZG9jdW1lbnQud29yZHByb2Nlc3NpbmdtbFwiKSB8fCAvXFwuKGRvY3xkb2N4KSQvLnRlc3QoZmlsZW5hbWUpKVxuICAgIHJldHVybiBcImRvY1wiO1xuICBpZiAoY29udGVudFR5cGUuaW5jbHVkZXMoXCJwb3dlcnBvaW50XCIpIHx8IGNvbnRlbnRUeXBlLmluY2x1ZGVzKFwib2ZmaWNlZG9jdW1lbnQucHJlc2VudGF0aW9ubWxcIikgfHwgL1xcLihwcHR8cHB0eCkkLy50ZXN0KGZpbGVuYW1lKSlcbiAgICByZXR1cm4gXCJwcHRcIjtcbiAgaWYgKGNvbnRlbnRUeXBlLmluY2x1ZGVzKFwiZXhjZWxcIikgfHwgY29udGVudFR5cGUuaW5jbHVkZXMoXCJvZmZpY2Vkb2N1bWVudC5zcHJlYWRzaGVldG1sXCIpIHx8IC9cXC4oeGxzfHhsc3gpJC8udGVzdChmaWxlbmFtZSkpIHJldHVybiBcInhsc1wiO1xuICByZXR1cm4gXCJ1bmtub3duXCI7XG59XG5cbi8qKlxuICogQ2FsY3VsYXRlcyB0aGUgZ3JhZGUgZm9yIGEgc3BlY2lmaWMgYXNzaWdubWVudCBncm91cC5cbiAqIEBwYXJhbSB7Kn0gZ3JvdXAgLSBUaGUgYXNzaWdubWVudCBncm91cCB0byBjYWxjdWxhdGUgdGhlIGdyYWRlIGZvci5cbiAqIEBwYXJhbSB7Kn0gYXNzaWdubWVudHMgLSBUaGUgbGlzdCBvZiBhc3NpZ25tZW50cy5cbiAqIEByZXR1cm5zIHtPYmplY3R9IEFuIG9iamVjdCBjb250YWluaW5nIHRoZSB0b3RhbCBwb2ludHMgcG9zc2libGUsIHRvdGFsIHBvaW50cyBlYXJuZWQsIGFuZCB0aGUgcGVyY2VudGFnZSBmb3IgdGhlIGFzc2lnbm1lbnQgZ3JvdXAuXG4gKi9cbmZ1bmN0aW9uIGNhbGN1bGF0ZUdyYWRlRm9yR3JvdXAoZ3JvdXAsIGFzc2lnbm1lbnRzKSB7XG4gIGNvbnN0IGdyb3VwQXNzaWdubWVudHMgPSBhc3NpZ25tZW50cy5maWx0ZXIoXG4gICAgKGFzc2lnbm1lbnQpID0+XG4gICAgICBhc3NpZ25tZW50LmFzc2lnbm1lbnRfZ3JvdXBfaWQgPT09IGdyb3VwLmlkICYmIGFzc2lnbm1lbnQuc3VibWlzc2lvbj8uZ3JhZGUgIT0gbnVsbCAmJiAhYXNzaWdubWVudC5vbWl0X2Zyb21fZmluYWxfZ3JhZGUsXG4gICk7XG5cbiAgY29uc3QgdG90YWxQb2ludHNQb3NzaWJsZSA9IGdyb3VwQXNzaWdubWVudHMucmVkdWNlKChzdW0sIGFzc2lnbm1lbnQpID0+IHN1bSArIChhc3NpZ25tZW50LnBvaW50c19wb3NzaWJsZSB8fCAwKSwgMCk7XG5cbiAgY29uc3QgdG90YWxQb2ludHNFYXJuZWQgPSBncm91cEFzc2lnbm1lbnRzLnJlZHVjZSgoc3VtLCBhc3NpZ25tZW50KSA9PiBzdW0gKyAoYXNzaWdubWVudC5zdWJtaXNzaW9uPy5zY29yZSB8fCAwKSwgMCk7XG5cbiAgcmV0dXJuIHtcbiAgICB0b3RhbFBvaW50c1Bvc3NpYmxlLFxuICAgIHRvdGFsUG9pbnRzRWFybmVkLFxuICAgIHBlcmNlbnRhZ2U6IHRvdGFsUG9pbnRzUG9zc2libGUgPiAwID8gKHRvdGFsUG9pbnRzRWFybmVkIC8gdG90YWxQb2ludHNQb3NzaWJsZSkgKiAxMDAgOiBudWxsLFxuICB9O1xufVxuLyoqXG4gKiBDYWxjdWxhdGVzIHRoZSB0b3RhbCB3ZWlnaHRlZCBncmFkZSBmb3IgYWxsIGFzc2lnbm1lbnRzIGluIGEgY291cnNlLlxuICogQHBhcmFtIHsqfSBhc3NpZ25tZW50cyAtIFRoZSBsaXN0IG9mIGFzc2lnbm1lbnRzLlxuICogQHBhcmFtIHsqfSBhc3NpZ25tZW50R3JvdXBzIC0gVGhlIGxpc3Qgb2YgYXNzaWdubWVudCBncm91cHMuXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgdG90YWwgd2VpZ2h0ZWQgZ3JhZGUgZm9yIHRoZSBjb3Vyc2UuXG4gKi9cbmZ1bmN0aW9uIGNhbGN1bGF0ZVRvdGFsV2VpZ2h0ZWRHcmFkZShhc3NpZ25tZW50cywgYXNzaWdubWVudEdyb3Vwcykge1xuICBpZiAoIWFzc2lnbm1lbnRHcm91cHMgfHwgYXNzaWdubWVudEdyb3Vwcy5sZW5ndGggPT09IDApIHtcbiAgICAvLyBjYWxjdWxhdGUgdGhlIHRvdGFsIGdyYWRlIHdpdGhvdXQgd2VpZ2h0aW5nIGlmIG5vIGFzc2lnbm1lbnQgZ3JvdXBzIGFyZSBwcm92aWRlZFxuICAgIGNvbnN0IGdyYWRlZEFzc2lnbm1lbnRzID0gYXNzaWdubWVudHMuZmlsdGVyKChhc3NpZ25tZW50KSA9PiBhc3NpZ25tZW50LnN1Ym1pc3Npb24/LmdyYWRlICE9IG51bGwgJiYgIWFzc2lnbm1lbnQub21pdF9mcm9tX2ZpbmFsX2dyYWRlKTtcbiAgICBjb25zdCB0b3RhbFBvaW50c1Bvc3NpYmxlID0gZ3JhZGVkQXNzaWdubWVudHMucmVkdWNlKChzdW0sIGFzc2lnbm1lbnQpID0+IHN1bSArIChhc3NpZ25tZW50LnBvaW50c19wb3NzaWJsZSB8fCAwKSwgMCk7XG4gICAgY29uc3QgdG90YWxQb2ludHNFYXJuZWQgPSBncmFkZWRBc3NpZ25tZW50cy5yZWR1Y2UoKHN1bSwgYXNzaWdubWVudCkgPT4gc3VtICsgKGFzc2lnbm1lbnQuc3VibWlzc2lvbj8uc2NvcmUgfHwgMCksIDApO1xuICAgIHJldHVybiB0b3RhbFBvaW50c1Bvc3NpYmxlID4gMCA/ICh0b3RhbFBvaW50c0Vhcm5lZCAvIHRvdGFsUG9pbnRzUG9zc2libGUpICogMTAwIDogbnVsbDtcbiAgfVxuXG4gIGxldCB0b3RhbFdlaWdodGVkU2NvcmUgPSAwO1xuICBsZXQgdG90YWxXZWlnaHQgPSAwO1xuXG4gIGFzc2lnbm1lbnRHcm91cHMuZm9yRWFjaCgoZ3JvdXApID0+IHtcbiAgICBjb25zdCBncm91cEdyYWRlID0gY2FsY3VsYXRlR3JhZGVGb3JHcm91cChncm91cCwgYXNzaWdubWVudHMpO1xuXG4gICAgaWYgKGdyb3VwR3JhZGUucGVyY2VudGFnZSAhPT0gbnVsbCkge1xuICAgICAgdG90YWxXZWlnaHRlZFNjb3JlICs9IGdyb3VwR3JhZGUucGVyY2VudGFnZSAqIChncm91cC5ncm91cF93ZWlnaHQgLyAxMDApO1xuICAgICAgdG90YWxXZWlnaHQgKz0gZ3JvdXAuZ3JvdXBfd2VpZ2h0O1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHRvdGFsV2VpZ2h0ID4gMCA/ICh0b3RhbFdlaWdodGVkU2NvcmUgLyB0b3RhbFdlaWdodCkgKiAxMDAgOiBudWxsO1xufVxuLyoqXG4gKiBDYWxjdWxhdGVzIHRoZSB0b3RhbCBwb2ludHMgZWFybmVkIGFuZCBwb3NzaWJsZSBhY3Jvc3MgYWxsIGFzc2lnbm1lbnRzIHJlZ2FyZGxlc3Mgb2Ygd2VpZ2h0aW5nLlxuICogQHBhcmFtIHtBcnJheX0gYXNzaWdubWVudHMgLSBUaGUgbGlzdCBvZiBhc3NpZ25tZW50cy5cbiAqIEByZXR1cm5zIHtPYmplY3R9IEFuIG9iamVjdCBjb250YWluaW5nIHRvdGFsUG9pbnRzRWFybmVkIGFuZCB0b3RhbFBvaW50c1Bvc3NpYmxlLlxuICovXG5mdW5jdGlvbiBjYWxjdWxhdGVUb3RhbFBvaW50cyhhc3NpZ25tZW50cykge1xuICBjb25zdCBncmFkZWRBc3NpZ25tZW50cyA9IGFzc2lnbm1lbnRzLmZpbHRlcigoYXNzaWdubWVudCkgPT4gYXNzaWdubWVudC5zdWJtaXNzaW9uPy5ncmFkZSAhPSBudWxsICYmICFhc3NpZ25tZW50Lm9taXRfZnJvbV9maW5hbF9ncmFkZSk7XG4gIGNvbnN0IHRvdGFsUG9pbnRzUG9zc2libGUgPSBncmFkZWRBc3NpZ25tZW50cy5yZWR1Y2UoKHN1bSwgYXNzaWdubWVudCkgPT4gc3VtICsgKGFzc2lnbm1lbnQucG9pbnRzX3Bvc3NpYmxlIHx8IDApLCAwKTtcbiAgY29uc3QgdG90YWxQb2ludHNFYXJuZWQgPSBncmFkZWRBc3NpZ25tZW50cy5yZWR1Y2UoKHN1bSwgYXNzaWdubWVudCkgPT4gc3VtICsgKGFzc2lnbm1lbnQuc3VibWlzc2lvbj8uc2NvcmUgfHwgMCksIDApO1xuXG4gIHJldHVybiB7XG4gICAgdG90YWxQb2ludHNQb3NzaWJsZSxcbiAgICB0b3RhbFBvaW50c0Vhcm5lZCxcbiAgfTtcbn1cbiJdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsTUFBTTtFQUFFLGFBQWE7RUFBRSxVQUFVO0VBQUUsUUFBUTtFQUFFO0FBQVUsQ0FBQyxHQUFHLEtBQUs7QUFFaEUsTUFBTSxhQUFhLEdBQUcsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDOztBQUV2QztBQUNBLE1BQU07RUFBRSxHQUFHO0VBQUUsR0FBRztFQUFFO0FBQUksQ0FBQyxHQUFHLFNBQVM7O0FBRW5DO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLGVBQWUsZ0JBQWdCLENBQUMsZUFBZSxFQUFFLElBQUksR0FBRyxNQUFNLEVBQUU7RUFDOUQsTUFBTSxPQUFPLEdBQUc7SUFBRTtFQUFLLENBQUM7O0VBRXhCO0VBQ0EsSUFBSSxDQUFDLE1BQU0sZUFBZSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsTUFBTSxTQUFTLEVBQUU7SUFDbEUsT0FBTyxJQUFJO0VBQ2I7O0VBRUE7RUFDQSxJQUFJLENBQUMsTUFBTSxlQUFlLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLE1BQU0sU0FBUyxF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
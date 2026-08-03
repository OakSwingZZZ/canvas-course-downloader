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
    },
    onClick: () => window.open("https://github.com/jasp-nerd/canvas-course-downloader", "_blank")
  }, /*#__PURE__*/React.createElement("img", {
    src: "data:image/png;base64,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",
    alt: "",
    width: "48",
    height: "48"
  })), /*#__PURE__*/React.createElement("div", {
    className: "side_navigation_item",
    onClick: () => alert("This might do somthing one day...")
  }, /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "ic-nav",
    version: "1.1",
    x: "0",
    y: "0",
    viewBox: "0 0 280 200",
    enableBackground: "new 0 0 280 200"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M273.09,180.75H197.47V164.47h62.62A122.16,122.16,0,1,0,17.85,142a124,124,0,0,0,2,22.51H90.18v16.29H6.89l-1.5-6.22A138.51,138.51,0,0,1,1.57,142C1.57,65.64,63.67,3.53,140,3.53S278.43,65.64,278.43,142a137.67,137.67,0,0,1-3.84,32.57ZM66.49,87.63,50.24,71.38,61.75,59.86,78,76.12Zm147,0L202,76.12l16.25-16.25,11.51,11.51ZM131.85,53.82v-23h16.29v23Zm15.63,142.3a31.71,31.71,0,0,1-28-16.81c-6.4-12.08-15.73-72.29-17.54-84.25a8.15,8.15,0,0,1,13.58-7.2c8.88,8.21,53.48,49.72,59.88,61.81a31.61,31.61,0,0,1-27.9,46.45ZM121.81,116.2c4.17,24.56,9.23,50.21,12,55.49A15.35,15.35,0,1,0,161,157.3C158.18,152,139.79,133.44,121.81,116.2Z"
  })), "Dashboard"), /*#__PURE__*/React.createElement("div", {
    className: "side_navigation_item",
    onClick: () => alert("This might do somthing one day...")
  }, /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    className: "ic-nav",
    version: "1.1",
    x: "0",
    y: "0",
    viewBox: "0 0 280 200",
    enableBackground: "new 0 0 280 200"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M73.31,198c-11.93,0-22.22,8-24,18.73a26.67,26.67,0,0,0-.3,3.63v.3a22,22,0,0,0,5.44,14.65,22.47,22.47,0,0,0,17.22,8H200V228.19h-134V213.08H200V198Zm21-105.74h90.64V62H94.3ZM79.19,107.34V46.92H200v60.42Zm7.55,30.21V122.45H192.49v15.11ZM71.65,16.71A22.72,22.72,0,0,0,49,39.36V190.88a41.12,41.12,0,0,1,24.32-8h157V16.71ZM33.88,39.36A37.78,37.78,0,0,1,71.65,1.6H245.36V198H215.15v45.32h22.66V258.4H71.65a37.85,37.85,0,0,1-37.76-37.76Z"
  })), "Courses"), /*#__PURE__*/React.createElement("div", {
    className: "side_navigation_item",
    id: "CV_SETTINGS_LINK"
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbImNvbnRleHRzL0NvdXJzZUNvbnRleHQuanN4IiwiY29udGV4dHMvTmF2aWdhdGlvbkNvbnRleHQuanN4IiwiY29tcG9uZW50cy9Bc3NpZ25tZW50UnVicmljLmpzeCIsImNvbXBvbmVudHMvQ2FudmFzSXRlbUljb24uanN4IiwiY29tcG9uZW50cy9DYW52YXNTdWJtaXNzaW9uLmpzeCIsImNvbXBvbmVudHMvQ29sbGFwc2VUYWJsZS5qc3giLCJjb21wb25lbnRzL0NvbnRleHRQaWxsLmpzeCIsImNvbXBvbmVudHMvQ291cnNlTGlzdC5qc3giLCJjb21wb25lbnRzL0NvdXJzZVBpY2tlci5qc3giLCJjb21wb25lbnRzL0RvY3hNZW1vcnlWaWV3ZXIuanN4IiwiY29tcG9uZW50cy9Mb2NhbEF0YXRjaG1lbnRWaWV3ZXIuanN4IiwiY29tcG9uZW50cy9QcHR4TWVtb3J5Vmlld2VyLmpzeCIsImNvbXBvbmVudHMvU2NvcmVEaXN0cmlidXRpb25HcmFwaC5qc3giLCJjb21wb25lbnRzL1RvcEJyZWFkY3J1bWJzLmpzeCIsInBhZ2VzL0Fubm91bmNlbWVudERldGFpbFBhZ2UuanN4IiwicGFnZXMvQW5ub3VuY2VtZW50c1BhZ2UuanN4IiwicGFnZXMvQXBwLmpzeCIsInBhZ2VzL0Fzc2lnbm1lbnREZXRhaWxWaWV3LmpzeCIsInBhZ2VzL0Fzc2lnbm1lbnRzUGFnZS5qc3giLCJwYWdlcy9EaXNjdXNzaW9uRGV0YWlsVmlldy5qc3giLCJwYWdlcy9EaXNjdXNzaW9uc1BhZ2UuanN4IiwicGFnZXMvRmlsZXNQYWdlLmpzeCIsInBhZ2VzL0ZpbGVzUGFnZURldGFpbFZpZXcuanN4IiwicGFnZXMvR3JhZGVzUGFnZS5qc3giLCJwYWdlcy9Ib21lUGFnZS5qc3giLCJwYWdlcy9NYWluQ29udGVudC5qc3giLCJwYWdlcy9Nb2R1bGVzUGFnZS5qc3giLCJwYWdlcy9OYW1lUHJvZmlsZUNhcmQuanN4IiwicGFnZXMvUGFnZURldGFpbFZpZXcuanN4IiwicGFnZXMvUGFnZXNQYWdlLmpzeCIsImhlbHBlcnMvSGVscGVycy5qc3giXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDb3Vyc2VDb250ZXh0IGNyZWF0ZXMgYW5kIHN0b3JlcyB0aGUgQ291cnNlIGRhdGEgZm9yIGxvYWRpbmcgYW5kIGRpc3BsYXlpbmcuIE9uY2UgdGhlIGRhdGEgaXMgcmV0cmlldmVkIHVzaW5nXG4gKiB0aGUgRmlsZSBTeXN0ZW0gQVBJLCB0aGUgZm9sZGVyIHJlZmVyZXJlciBpcyBzYXZlZCB0byBpbmRleGVkZGIgc28gaXQgY2FuIGJlIGFjY2Vzc2VkIGxhdGVyLlxuICovXG5cbmNvbnN0IHsgY3JlYXRlQ29udGV4dCwgdXNlQ29udGV4dCwgdXNlU3RhdGUsIHVzZUVmZmVjdCB9ID0gUmVhY3Q7XG5cbmNvbnN0IENvdXJzZUNvbnRleHQgPSBjcmVhdGVDb250ZXh0KCk7IC8vIENyZWF0ZSBhIGNvbnRleHQgZm9yIGNvdXJzZSBkYXRhXG5cbi8vIEdldCB0aGUgSW5kZXhkREIgdG9vbHNcbmNvbnN0IHsgZ2V0LCBzZXQsIGRlbCB9ID0gaWRiS2V5dmFsO1xuXG4vKipcbiAqIENyZWF0aW5nIGEgY29udGV4dCBmb3IgY291cnNlIGRhdGEgc28gaXQgY2FuIGJlIGFjY2Vzc2VkIGJ5IGFsbCBjb21wb25lbnRzLlxuICovXG5cbi8vIEhlbHBlciBmdW5jdGlvbiB0byBjaGVjayBhbmQgcmVxdWVzdCBwZXJtaXNzaW9ucyBmb3IgYSBoYW5kbGVcbmFzeW5jIGZ1bmN0aW9uIHZlcmlmeVBlcm1pc3Npb24oZGlyZWN0b3J5SGFuZGxlLCBtb2RlID0gXCJyZWFkXCIpIHtcbiAgY29uc3Qgb3B0aW9ucyA9IHsgbW9kZSB9O1xuXG4gIC8vIENoZWNrIGlmIHdlIGFscmVhZHkgaGF2ZSBwZXJtaXNzaW9uXG4gIGlmICgoYXdhaXQgZGlyZWN0b3J5SGFuZGxlLnF1ZXJ5UGVybWlzc2lvbihvcHRpb25zKSkgPT09IFwiZ3JhbnRlZFwiKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyBJZiBub3QsIHJlcXVlc3QgcGVybWlzc2lvbiAodGhpcyBtdXN0IGJlIHRyaWdnZXJlZCBieSBhIHVzZXIgZ2VzdHVyZSwgbGlrZSBhIGJ1dHRvbiBjbGljaylcbiAgaWYgKChhd2FpdCBkaXJlY3RvcnlIYW5kbGUucmVxdWVzdFBlcm1pc3Npb24ob3B0aW9ucykpID09PSBcImdyYW50ZWRcIikge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBDb3Vyc2VDb250ZXh0UHJvdmlkZXIoeyBjaGlsZHJlbiB9KSB7XG4gIGNvbnN0IFtjb3Vyc2VEYXRhLCBzZXRDb3Vyc2VEYXRhXSA9IHVzZVN0YXRlKG51bGwpO1xuICBjb25zdCBbZGlySGFuZGxlLCBzZXREaXJIYW5kbGVdID0gdXNlU3RhdGUobnVsbCk7XG4gIGNvbnN0IFtpc1Byb2Nlc3NpbmcsIHNldElzUHJvY2Vzc2luZ10gPSB1c2VTdGF0ZSh0cnVlKTsgLy8gU3RhcnQgbG9hZGluZyBzYXZlZCBkYXRhXG5cbiAgLy8gT24gbW91bnQsIGxvYWQgcHJldmlvdXNseSBzYXZlZCBKU09OIGRhdGEgYW5kIHRoZSBkaXJlY3RvcnkgaGFuZGxlIGZyb20gSW5kZXhlZERCXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgYXN5bmMgZnVuY3Rpb24gbG9hZENhY2hlZERhdGEoKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBbY2FjaGVkRGF0YSwgY2FjaGVkSGFuZGxlXSA9IGF3YWl0IFByb21pc2UuYWxsKFtnZXQoXCJjYWNoZWRDb3Vyc2VEYXRhXCIpLCBnZXQoXCJjb3Vyc2VEaXJlY3RvcnlIYW5kbGVcIildKTtcblxuICAgICAgICBpZiAoY2FjaGVkRGF0YSkgc2V0Q291cnNlRGF0YShjYWNoZWREYXRhKTtcbiAgICAgICAgaWYgKGNhY2hlZEhhbmRsZSkgc2V0RGlySGFuZGxlKGNhY2hlZEhhbmRsZSk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiRmV0Y2hlZCBDb3Vyc2UgRGF0YSFcIilcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiRmFpbGVkIHRvIGxvYWQgY2FjaGVkIGRhdGEgZnJvbSBzdG9yYWdlOlwiLCBlcnIpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgc2V0SXNQcm9jZXNzaW5nKGZhbHNlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsb2FkQ2FjaGVkRGF0YSgpO1xuICB9LCBbXSk7XG5cbiAgLy8gSW5pdGlhbCBmb2xkZXIgc2VsZWN0aW9uIChVc2VyIHBpY2tzIHRoZSBmb2xkZXIpXG4gIGNvbnN0IGhhbmRsZUZvbGRlclNlbGVjdCA9IGFzeW5jICgpID0+IHtcbiAgICBzZXRJc1Byb2Nlc3NpbmcodHJ1ZSk7XG4gICAgdHJ5IHtcbiAgICAgIC8vIFByb21wdCB1c2VyIGZvciBmb2xkZXIgYWNjZXNzICh1c2luZyBGaWxlIFN5c3RlbSBBY2Nlc3MgQVBJKVxuICAgICAgY29uc3QgaGFuZGxlID0gYXdhaXQgd2luZG93LnNob3dEaXJlY3RvcnlQaWNrZXIoKTtcbiAgICAgIGxldCBqc29uRmlsZXNPYmplY3QgPSBhd2FpdCBzY3JhcGVKc29uRmlsZXMoaGFuZGxlKTtcblxuICAgICAgaWYgKGpzb25GaWxlc09iamVjdD8ubWFuaWZlc3Q/Lm1hbmlmZXN0VmVyc2lvbiA+PSAyKSB7XG4gICAgICAgIC8vIFNhdmUgdG8gUmVhY3QgU3RhdGVcbiAgICAgICAgc2V0Q291cnNlRGF0YShqc29uRmlsZXNPYmplY3QpO1xuICAgICAgICBzZXREaXJIYW5kbGUoaGFuZGxlKTtcblxuICAgICAgICAvLyBTYXZlIHRvIEluZGV4ZWREQlxuICAgICAgICBhd2FpdCBzZXQoXCJjYWNoZWRDb3Vyc2VEYXRhXCIsIGpzb25GaWxlc09iamVjdCk7XG4gICAgICAgIGF3YWl0IHNldChcImNvdXJzZURpcmVjdG9yeUhhbmRsZVwiLCBoYW5kbGUpOyAvLyA8LS0gU2F2aW5nIHRoZSBoYW5kbGVcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFsZXJ0KFwiSW52YWxpZCBtYW5pZmVzdCB2ZXJzaW9uLiBQbGVhc2Ugc2VsZWN0IGEgdmFsaWQgY291cnNlIGZvbGRlci5cIik7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFwiQWNjZXNzIGRlbmllZCBvciBlcnJvciBkaWdlc3RpbmcgZm9sZGVyXCIsIGVycik7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNldElzUHJvY2Vzc2luZyhmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIC8vIFJlLWF1dGhlbnRpY2F0ZSBhbiBleGlzdGluZyBoYW5kbGUgKFVzZXIgZ3JhbnRzIHBlcm1pc3Npb24gdG8gcHJldmlvdXNseSBzYXZlZCBmb2xkZXIpXG4gIGNvbnN0IHJlY29ubmVjdEZvbGRlciA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAoIWRpckhhbmRsZSkgcmV0dXJuO1xuXG4gICAgc2V0SXNQcm9jZXNzaW5nKHRydWUpO1xuICAgIHRyeSB7XG4gICAgICAvLyBUaGlzIHdpbGwgcHJvbXB0IHRoZSBicm93c2VyIHBlcm1pc3Npb24gZGlhbG9nIGlmIG5lZWRlZFxuICAgICAgY29uc3QgaGFzUGVybWlzc2lvbiA9IGF3YWl0IHZlcmlmeVBlcm1pc3Npb24oZGlySGFuZGxlLCBcInJlYWRcIik7XG5cbiAgICAgIGlmIChoYXNQZXJtaXNzaW9uKSB7XG4gICAgICAgIC8vIFlvdSBub3cgaGF2ZSBhY3RpdmUgYWNjZXNzIHRvIHRoZSBmb2xkZXIgYWdhaW4hXG4gICAgICAgIC8vIE9wdGlvbmFsOiBSZS1zY3JhcGUgdGhlIGZvbGRlciBoZXJlIHRvIGdldCBmcmVzaCBkYXRhIGluc3RlYWQgb2YgdXNpbmcgY2FjaGVcbiAgICAgICAgLy8gbGV0IGZyZXNoRGF0YSA9IGF3YWl0IHNjcmFwZUpzb25GaWxlcyhkaXJIYW5kbGUpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIlBlcm1pc3Npb24gZ3JhbnRlZCEgRGlyZWN0b3J5IGhhbmRsZSBpcyBhY3RpdmUuXCIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWxlcnQoXCJQZXJtaXNzaW9uIHRvIGFjY2VzcyB0aGUgZm9sZGVyIHdhcyBkZW5pZWQuXCIpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIHJlY29ubmVjdGluZyB0byBmb2xkZXI6XCIsIGVycik7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNldElzUHJvY2Vzc2luZyhmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIC8vIENsZWFyIHN0b3JlZCBkYXRhXG4gIGNvbnN0IGNsZWFyQ291cnNlRGF0YSA9IGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBQcm9taXNlLmFsbChbZGVsKFwiY2FjaGVkQ291cnNlRGF0YVwiKSwgZGVsKFwiY291cnNlRGlyZWN0b3J5SGFuZGxlXCIpXSk7XG4gICAgc2V0Q291cnNlRGF0YShudWxsKTtcbiAgICBzZXREaXJIYW5kbGUobnVsbCk7XG4gIH07XG5cbiAgcmV0dXJuIChcbiAgICA8Q291cnNlQ29udGV4dC5Qcm92aWRlclxuICAgICAgdmFsdWU9e3tcbiAgICAgICAgY291cnNlRGF0YSxcbiAgICAgICAgZGlySGFuZGxlLFxuICAgICAgICBpc1Byb2Nlc3NpbmcsXG4gICAgICAgIGhhbmRsZUZvbGRlclNlbGVjdCxcbiAgICAgICAgcmVjb25uZWN0Rm9sZGVyLCAvLyBFeHBvcnQgdGhlIG5ldyBmdW5jdGlvblxuICAgICAgICBjbGVhckNvdXJzZURhdGEsXG4gICAgICB9fVxuICAgID5cbiAgICAgIHtjaGlsZHJlbn1cbiAgICA8L0NvdXJzZUNvbnRleHQuUHJvdmlkZXI+XG4gICk7XG59XG5cbmZ1bmN0aW9uIHVzZUNvdXJzZUNvbnRleHQoKSB7XG4gIHJldHVybiB1c2VDb250ZXh0KENvdXJzZUNvbnRleHQpO1xufVxuLy8gRnVuY3Rpb24gdG8gdGFrZSBkaWdlc3QgdGhlIGZvbGRlciBkYXRhIGludG8gZXZlcnkgYXZhaWxhYmxlIEpTT04gZmlsZVxuYXN5bmMgZnVuY3Rpb24gc2NyYXBlSnNvbkZpbGVzKGRpckhhbmRsZSkge1xuICBjb25zdCBqc29uRmlsZXNPYmplY3QgPSB7fTtcblxuICBhc3luYyBmdW5jdGlvbiB3YWxrRGlyZWN0b3J5KGhhbmRsZSkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgZW50cnkgb2YgaGFuZGxlLnZhbHVlcygpKSB7XG4gICAgICBpZiAoZW50cnkua2luZCA9PT0gXCJmaWxlXCIgJiYgZW50cnkubmFtZS5lbmRzV2l0aChcIi5qc29uXCIpKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gR2V0IHRoZSBzdGFuZGFyZCBGaWxlIG9iamVjdFxuICAgICAgICAgIGNvbnN0IGZpbGUgPSBhd2FpdCBlbnRyeS5nZXRGaWxlKCk7XG5cbiAgICAgICAgICAvLyBSZWFkIGFuZCBwYXJzZSB0aGUgSlNPTiBzdHJpbmdcbiAgICAgICAgICBjb25zdCB0ZXh0ID0gYXdhaXQgZmlsZS50ZXh0KCk7XG4gICAgICAgICAgY29uc3QgcGFyc2VkRGF0YSA9IEpTT04ucGFyc2UodGV4dCk7XG4gICAgICAgICAgY29uc29sZS5sb2coYFBhcnNlZCBKU09OIGZvciBmaWxlOiAke2VudHJ5Lm5hbWV9YCwgcGFyc2VkRGF0YSk7XG5cbiAgICAgICAgICAvLyBVc2UgdGhlIGZpbGUgbmFtZSBhcyB0aGUga2V5LCBzdHJpcHBpbmcgdGhlIC5qc29uIGV4dGVuc2lvblxuICAgICAgICAgIGpzb25GaWxlc09iamVjdFtlbnRyeS5uYW1lLnNsaWNlKDAsIC01KV0gPSBwYXJzZWREYXRhO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYEZhaWxlZCB0byBwYXJzZSBKU09OIGZvciBmaWxlOiAke2VudHJ5Lm5hbWV9YCwgZXJyKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChlbnRyeS5raW5kID09PSBcImRpcmVjdG9yeVwiKSB7XG4gICAgICAgIC8vIFJlY3Vyc2UgaW50byBuZXN0ZWQgc3ViZm9sZGVyc1xuICAgICAgICBhd2FpdCB3YWxrRGlyZWN0b3J5KGVudHJ5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBhd2FpdCB3YWxrRGlyZWN0b3J5KGRpckhhbmRsZSk7XG4gIHJldHVybiBqc29uRmlsZXNPYmplY3Q7XG59XG4iLCIvKipcbiAqIENyZWF0aW5nIGEgY29udGV4dCBzbyB0aGF0IHdlIGNhbiBlbmFibGUgbmF2aWdhdGlvbiB0aHJvdWdob3V0IHRoZSBhcHBcbiAqL1xuY29uc3QgTmF2aWdhdGlvbkNvbnRleHQgPSBSZWFjdC5jcmVhdGVDb250ZXh0KCk7XG5mdW5jdGlvbiBOYXZpZ2F0aW9uUHJvdmlkZXIoeyBjaGlsZHJlbiB9KSB7XG4gIGNvbnN0IFthY3RpdmVLZXksIHNldEFjdGl2ZUtleV0gPSB1c2VTdGF0ZShcImZyb250cGFnZVwiKTtcbiAgY29uc3QgW3NlbGVjdGVkQXNzaWdubWVudElkLCBzZXRTZWxlY3RlZEFzc2lnbm1lbnRJZF0gPSB1c2VTdGF0ZShudWxsKTtcbiAgY29uc3QgW3NlbGVjdGVkUGFnZVVybCwgc2V0U2VsZWN0ZWRQYWdlVXJsXSA9IHVzZVN0YXRlKG51bGwpO1xuICBjb25zdCBbc2VsZWN0ZWREaXNjdXNzaW9uSWQsIHNldFNlbGVjdGVkRGlzY3Vzc2lvbklkXSA9IHVzZVN0YXRlKG51bGwpO1xuICBjb25zdCBbc2VsZWN0ZWRBbm5vdW5jZW1lbnRJZCwgc2V0U2VsZWN0ZWRBbm5vdW5jZW1lbnRJZF0gPSB1c2VTdGF0ZSgpO1xuXG4gIC8vIE5hdmlnYXRlIHRvIGEgbWFpbiBzZWN0aW9uIChyZXNldHMgc3ViLXZpZXcgZGV0YWlsKVxuICBjb25zdCBuYXZpZ2F0ZVRvU2VjdGlvbiA9IChrZXkpID0+IHtcbiAgICBzZXRBY3RpdmVLZXkoa2V5KTtcbiAgICBzZXRTZWxlY3RlZEFzc2lnbm1lbnRJZChudWxsKTtcbiAgICBzZXRTZWxlY3RlZFBhZ2VVcmwobnVsbCk7XG4gICAgc2V0U2VsZWN0ZWREaXNjdXNzaW9uSWQobnVsbCk7XG4gIH07XG4gIC8vIE5hdmlnYXRlIGRpcmVjdGx5IHRvIGEgc3BlY2lmaWMgYXNzaWdubWVudCBkZXRhaWwgdmlld1xuICBjb25zdCBuYXZpZ2F0ZVRvQXNzaWdubWVudCA9IChhc3NpZ25tZW50SWQpID0+IHtcbiAgICBzZXRBY3RpdmVLZXkoXCJhc3NpZ25tZW50c1wiKTsgLy8gS2VlcHMgXCJBc3NpZ25tZW50c1wiIGFjdGl2ZSBvbiB0aGUgbGVmdCBzaWRlYmFyIVxuICAgIHNldFNlbGVjdGVkQXNzaWdubWVudElkKGFzc2lnbm1lbnRJZCk7XG4gICAgc2V0U2VsZWN0ZWRQYWdlVXJsKG51bGwpO1xuICB9O1xuICAvLyBOYXZpZ2F0ZSBkaXJlY3RseSB0byBhIHNwZWNpZmljIHBhZ2UgZGV0YWlsIHZpZXdcbiAgY29uc3QgbmF2aWdhdGVUb1BhZ2UgPSAocGFnZVVybCkgPT4ge1xuICAgIHNldEFjdGl2ZUtleShcInBhZ2VzXCIpOyAvLyBLZWVwcyBcIlBhZ2VzXCIgYWN0aXZlIG9uIHRoZSBsZWZ0IHNpZGViYXIhXG4gICAgc2V0U2VsZWN0ZWRQYWdlVXJsKHBhZ2VVcmwpO1xuICAgIHNldFNlbGVjdGVkQXNzaWdubWVudElkKG51bGwpO1xuICB9O1xuICBjb25zdCBuYXZpZ2F0ZVRvRGlzY3Vzc2lvbiA9IChkaXNjdXNzaW9uSWQpID0+IHtcbiAgICBzZXRBY3RpdmVLZXkoXCJkaXNjdXNzaW9uc1wiKTsgLy8gS2VlcHMgXCJQYWdlc1wiIGFjdGl2ZSBvbiB0aGUgbGVmdCBzaWRlYmFyIVxuICAgIHNldFNlbGVjdGVkRGlzY3Vzc2lvbklkKGRpc2N1c3Npb25JZCk7XG4gICAgc2V0U2VsZWN0ZWRBc3NpZ25tZW50SWQobnVsbCk7XG4gIH07XG4gIGNvbnN0IG5hdmlnYXRlVG9Bbm5vdW5jZW1lbnQgPSAoYW5ub3VuY2VtZW50SWQpID0+IHtcbiAgICBzZXRBY3RpdmVLZXkoXCJhbm5vdW5jZW1lbnRzXCIpOyAvLyBLZWVwcyBcIlBhZ2VzXCIgYWN0aXZlIG9uIHRoZSBsZWZ0IHNpZGViYXIhXG4gICAgc2V0U2VsZWN0ZWRBbm5vdW5jZW1lbnRJZChhbm5vdW5jZW1lbnRJZCk7XG4gICAgc2V0U2VsZWN0ZWRBc3NpZ25tZW50SWQobnVsbCk7XG4gIH07XG4gIHJldHVybiAoXG4gICAgPE5hdmlnYXRpb25Db250ZXh0LlByb3ZpZGVyXG4gICAgICB2YWx1ZT17e1xuICAgICAgICBhY3RpdmVLZXksXG4gICAgICAgIHNlbGVjdGVkQXNzaWdubWVudElkLFxuICAgICAgICBzZWxlY3RlZFBhZ2VVcmwsXG4gICAgICAgIHNlbGVjdGVkRGlzY3Vzc2lvbklkLFxuICAgICAgICBzZWxlY3RlZEFubm91bmNlbWVudElkLFxuICAgICAgICBuYXZpZ2F0ZVRvU2VjdGlvbixcbiAgICAgICAgbmF2aWdhdGVUb0Fzc2lnbm1lbnQsXG4gICAgICAgIG5hdmlnYXRlVG9QYWdlLFxuICAgICAgICBuYXZpZ2F0ZVRvRGlzY3Vzc2lvbixcbiAgICAgICAgbmF2aWdhdGVUb0Fubm91bmNlbWVudCxcbiAgICAgIH19XG4gICAgPlxuICAgICAge2NoaWxkcmVufVxuICAgIDwvTmF2aWdhdGlvbkNvbnRleHQuUHJvdmlkZXI+XG4gICk7XG59XG5jb25zdCB1c2VOYXZpZ2F0aW9uID0gKCkgPT4gUmVhY3QudXNlQ29udGV4dChOYXZpZ2F0aW9uQ29udGV4dCk7XG4iLCIvKipcbiAqIFRoaXMgZnVuY3Rpb24gcmVuZGVycyB0aGUgcnVicmljIGZvciBhbiBhc3NpZ25tZW50J3MgZGV0YWlsZWQgdmlldy5cbiAqIEBwYXJhbSB7Kn0gcnVicmljIC0gVGhlIHJ1YnJpYyBmb3IgdGhlIGFzc2lnbm1lbnQuXG4gKiBAcmV0dXJucyBUaGUgcnVicmljIGNvbXBvbmVudCBmb3IgdGhlIGFzc2lnbm1lbnQuXG4gKi9cbmZ1bmN0aW9uIEFzc2lnbm1lbnRSdWJyaWMoeyBydWJyaWMgfSkge1xuICBpZiAoIUFycmF5LmlzQXJyYXkocnVicmljKSB8fCBydWJyaWMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPSdhc3NpZ25tZW50LXJ1YnJpYy1jb250YWluZXInIHN0eWxlPXt7IG1hcmdpblRvcDogXCIxZW1cIiB9fT5cbiAgICAgIDxoM1xuICAgICAgICBzdHlsZT17e1xuICAgICAgICAgIGZvbnRTaXplOiBcIjEuMWVtXCIsXG4gICAgICAgICAgbWFyZ2luQm90dG9tOiBcIjAuNWVtXCIsXG4gICAgICAgICAgY29sb3I6IFwiIzI3MzU0MFwiLFxuICAgICAgICB9fVxuICAgICAgPlxuICAgICAgICBSdWJyaWNcbiAgICAgIDwvaDM+XG4gICAgICA8dGFibGVcbiAgICAgICAgY2xhc3NOYW1lPSdydWJyaWMtdGFibGUnXG4gICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgd2lkdGg6IFwiMTAwJVwiLFxuICAgICAgICAgIGJvcmRlckNvbGxhcHNlOiBcImNvbGxhcHNlXCIsXG4gICAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCAjZThlYWVjXCIsXG4gICAgICAgICAgZm9udFNpemU6IFwiMTRweFwiLFxuICAgICAgICB9fVxuICAgICAgPlxuICAgICAgICA8dGhlYWQ+XG4gICAgICAgICAgPHRyIHN0eWxlPXt7IGJhY2tncm91bmRDb2xvcjogXCIjZjJmNGY0XCIsIHRleHRBbGlnbjogXCJsZWZ0XCIgfX0+XG4gICAgICAgICAgICA8dGhcbiAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICBwYWRkaW5nOiBcIjhweCAxMnB4XCIsXG4gICAgICAgICAgICAgICAgYm9yZGVyQm90dG9tOiBcIjFweCBzb2xpZCAjY2NjXCIsXG4gICAgICAgICAgICAgIH19XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIENyaXRlcmlhXG4gICAgICAgICAgICA8L3RoPlxuICAgICAgICAgICAgPHRoXG4gICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgcGFkZGluZzogXCI4cHggMTJweFwiLFxuICAgICAgICAgICAgICAgIGJvcmRlckJvdHRvbTogXCIxcHggc29saWQgI2NjY1wiLFxuICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICBSYXRpbmdzXG4gICAgICAgICAgICA8L3RoPlxuICAgICAgICAgICAgPHRoXG4gICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgcGFkZGluZzogXCI4cHggMTJweFwiLFxuICAgICAgICAgICAgICAgIGJvcmRlckJvdHRvbTogXCIxcHggc29saWQgI2NjY1wiLFxuICAgICAgICAgICAgICAgIHRleHRBbGlnbjogXCJyaWdodFwiLFxuICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICBQdHNcbiAgICAgICAgICAgIDwvdGg+XG4gICAgICAgICAgPC90cj5cbiAgICAgICAgPC90aGVhZD5cbiAgICAgICAgPHRib2R5PlxuICAgICAgICAgIHtydWJyaWMubWFwKChjcml0LCBpZHgpID0+IChcbiAgICAgICAgICAgIDx0ciBrZXk9e2NyaXQuaWQgfHwgaWR4fSBzdHlsZT17eyBib3JkZXJCb3R0b206IFwiMXB4IHNvbGlkICNlOGVhZWNcIiB9fT5cbiAgICAgICAgICAgICAgPHRkXG4gICAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgIHBhZGRpbmc6IFwiMTBweCAxMnB4XCIsXG4gICAgICAgICAgICAgICAgICB2ZXJ0aWNhbEFsaWduOiBcInRvcFwiLFxuICAgICAgICAgICAgICAgICAgd2lkdGg6IFwiMzAlXCIsXG4gICAgICAgICAgICAgICAgICBib3JkZXJSaWdodDogXCIxcHggc29saWQgI2U4ZWFlY1wiLFxuICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0ncnVicmljLXBvcG92ZXItd3JhcHBlcic+XG4gICAgICAgICAgICAgICAgICA8c3Ryb25nPntjcml0LmRlc2NyaXB0aW9ufTwvc3Ryb25nPlxuICAgICAgICAgICAgICAgICAge2NyaXQubG9uZ19kZXNjcmlwdGlvbiAmJiAoXG4gICAgICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9J3J1YnJpYy1wb3BvdmVyJ1xuICAgICAgICAgICAgICAgICAgICAgIGRhbmdlcm91c2x5U2V0SW5uZXJIVE1MPXt7XG4gICAgICAgICAgICAgICAgICAgICAgICBfX2h0bWw6IGNyaXQubG9uZ19kZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICB7Y3JpdC5sb25nX2Rlc2NyaXB0aW9uICYmIChcbiAgICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgICAgICBmb250U2l6ZTogXCIxMnB4XCIsXG4gICAgICAgICAgICAgICAgICAgICAgY29sb3I6IFwiIzU5NmE3NVwiLFxuICAgICAgICAgICAgICAgICAgICAgIG1hcmdpblRvcDogXCI0cHhcIixcbiAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgZGFuZ2Vyb3VzbHlTZXRJbm5lckhUTUw9e3tcbiAgICAgICAgICAgICAgICAgICAgICBfX2h0bWw6IGNyaXQubG9uZ19kZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgPHRkIHN0eWxlPXt7IHBhZGRpbmc6IFwiMTBweCAxMnB4XCIsIHZlcnRpY2FsQWxpZ246IFwidG9wXCIgfX0+XG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiBcImZsZXhcIiwgZmxleFdyYXA6IFwid3JhcFwiLCBnYXA6IFwiOHB4XCIgfX0+XG4gICAgICAgICAgICAgICAgICB7QXJyYXkuaXNBcnJheShjcml0LnJhdGluZ3MpICYmXG4gICAgICAgICAgICAgICAgICAgIGNyaXQucmF0aW5ncy5tYXAoKHJhdGluZywgcklkeCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBvcG92ZXJUZXh0ID0gcmF0aW5nLmxvbmdfZGVzY3JpcHRpb24gfHwgcmF0aW5nLmRlc2NyaXB0aW9uO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGtleT17cmF0aW5nLmlkIHx8IHJJZHh9IGNsYXNzTmFtZT0ncnVicmljLXJhdGluZy1jYXJkJz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAge3BvcG92ZXJUZXh0ICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9J3J1YnJpYy1wb3BvdmVyJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGFuZ2Vyb3VzbHlTZXRJbm5lckhUTUw9e3tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgX19odG1sOiBwb3BvdmVyVGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250V2VpZ2h0OiBcImJvbGRcIiwgY29sb3I6IFwiIzAwODE0OFwiIH19PntyYXRpbmcucG9pbnRzfSBwdHM8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdj57cmF0aW5nLmRlc2NyaXB0aW9ufTwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfSl9XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgIDx0ZFxuICAgICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgICBwYWRkaW5nOiBcIjEwcHggMTJweFwiLFxuICAgICAgICAgICAgICAgICAgdmVydGljYWxBbGlnbjogXCJ0b3BcIixcbiAgICAgICAgICAgICAgICAgIHRleHRBbGlnbjogXCJyaWdodFwiLFxuICAgICAgICAgICAgICAgICAgZm9udFdlaWdodDogXCJib2xkXCIsXG4gICAgICAgICAgICAgICAgICB3aWR0aDogXCIxMCVcIixcbiAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAge2NyaXQucG9pbnRzfSBwdHNcbiAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgKSl9XG4gICAgICAgIDwvdGJvZHk+XG4gICAgICA8L3RhYmxlPlxuICAgIDwvZGl2PlxuICApO1xufVxuIiwiLyoqXG4gKiBBIGNvbXBvbmVudCB0aGF0IHJlbmRlcnMgYW4gYXNzaWdubWVudCBpY29uLlxuICogQGRlc2NyaXB0aW9uIFRoaXMgY29tcG9uZW50IGlzIHVzZWQgdG8gZGlzcGxheSBkaWZmZXJlbnQgaWNvbnMgYmFzZWQgb24gdGhlIHR5cGUgb2YgdGhlIGl0ZW0uIEZvdW5kIHBhdGhzIGF0OiBodHRwczovL2luc3RydWN0dXJlLmRlc2lnbi9sZWdhY3ktaWNvbnNcbiAqIEBwYXJhbSB7c3RyaW5nfSBpY29uX3R5cGUgLSBUaGUgdHlwZSBvZiB0aGUgaWNvbiB0byBkaXNwbGF5IChsb3dlcmNhc2UpLlxuICogSW5vZnJtYXRpb246ICBbJ0ZpbGUnIG9yICdQYWdlJyBvciAnRGlzY3Vzc2lvbicgb3IgJ0Fzc2lnbm1lbnQnIG9yICdRdWl6JyBvciAnU3ViSGVhZGVyJyBvciAnRXh0ZXJuYWxVcmwnIG9yICdFeHRlcm5hbFRvb2wnXVxuICogQHBhcmFtIHtPYmplY3R9IHByb3BzIC0gVGhlIGNvbXBvbmVudCBwcm9wcy5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gcHJvcHMuaXNNb2R1bGVJdGVtIC0gV2hldGhlciB0aGUgaWNvbiBpcyBmb3IgYSBtb2R1bGUgaXRlbS5cbiAqL1xuZnVuY3Rpb24gQ2FudmFzSXRlbUljb24oeyBpY29uX3R5cGUsIGlzTW9kdWxlSXRlbSB9KSB7XG4gIGZ1bmN0aW9uIGdldFBhdGhEYXRhKGljb25fdHlwZSkge1xuICAgIHN3aXRjaCAoaWNvbl90eXBlKSB7XG4gICAgICBjYXNlIFwiYXNzaWdubWVudFwiOlxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIDxwYXRoXG4gICAgICAgICAgICBkPSdNMTQ2OC4yMTQgMHY1NjQuNjk4aC0xMTIuOTRWMTEyLjk0SDExMi45NHYxNjk0LjA5MmgxMjQyLjMzNHYtMjI1Ljg3OWgxMTIuOTR2MzM4LjgxOUgwVjBoMTQ2OC4yMTRabTEyOS40MjggNTgxLjMxMWMyMi4xMzctMjIuMTM2IDU3LjgyNS0yMi4xMzYgNzkuOTYyIDBsMjI1Ljg3OSAyMjUuODc5YzIyLjAyMyAyMi4wMjMgMjIuMDIzIDU3LjcxMiAwIDc5Ljg0OGwtNjc3LjYzOCA2NzcuNjM3Yy0xMC42MTYgMTAuNTA0LTI0Ljk2IDE2LjQ5LTM5Ljk4IDE2LjQ5aC0yMjUuODhjLTMxLjE3IDAtNTYuNDY5LTI1LjI5OS01Ni40NjktNTYuNDd2LTIyNS44OGMwLTE1LjAyIDUuOTg2LTI5LjM2NCAxNi40OS0zOS44NjdabS0xNTUuMjkxIDMxNC45ODgtNDI1Ljg5NSA0MjUuODk1djE0Ni4wMzFoMTQ2LjAzbDQyNS44OTUtNDI1Ljg5NS0xNDYuMDMtMTQ2LjAzWm0tNzY0LjcxNCAzNDYuMDQ3djExMi45NEgzMzguODJ2LTExMi45NGgzMzguODE4Wm0yMjUuODgtMjI1Ljg4djExMi45NEgzMzguODE4di0xMTIuOTRoNTY0LjY5N1ptNzM0LjEwNi0zMTUuNDQtMTE1LjQyNCAxMTUuNDI1IDE0Ni4wMyAxNDYuMDMgMTE1LjQyNS0xMTUuNDIzLTE0Ni4wMzEtMTQ2LjAzMVpNMTEyOS4zOTUgMzM4LjgzdjQ1MS43NThIMzM4LjgyVjMzOC44M2g3OTAuNTc2Wm0tMTEyLjk0IDExMi45NEg0NTEuNzU5djIyNS44NzhoNTY0LjY5OFY0NTEuNzdaJ1xuICAgICAgICAgICAgZmlsbFJ1bGU9J2V2ZW5vZGQnXG4gICAgICAgICAgLz5cbiAgICAgICAgKTtcbiAgICAgIGNhc2UgXCJmaWxlXCI6IC8vIFwicGFwZXJjbGlwXCIgaXMgdGhlIGljb24gZm9yIGZpbGVzIGluIENhbnZhc1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIDxwYXRoXG4gICAgICAgICAgICBkPSdNMTc1Mi43NjggMjIxLjEwOUMxNTMyLjY0Ni45ODYgMTE3NC4yODMuOTg2IDk1NC4xNjEgMjIxLjEwOWwtODM4LjU4OCA4MzguNTg4Yy0xNTQuMDUyIDE1NC4xNjUtMTU0LjA1MiA0MDQuODk0IDAgNTU4Ljk0NiAxNDkuNTM0IDE0OS40MjEgNDA5Ljk3NiAxNDkuMzA4IDU1OS4wNTkgMGw3NTguNzM4LTc1OC42MjZjODcuOTgyLTg4LjA5NCA4Ny45ODItMjMxLjQxNyAwLTMxOS41MS04OC4zMi04OC4yMDgtMjMxLjY0Mi04Ny45ODItMzE5LjUxIDBsLTYzOC43OTYgNjM4LjkwOCA3OS44NSA3OS44NDkgNjM4Ljc5NS02MzguOTA4YzQzLjkzNC00My44MjEgMTE1LjUzOS00My45MzQgMTU5LjgxMiAwIDQzLjkzNCA0NC4wNDcgNDMuOTM0IDExNS44NzcgMCAxNTkuODEybC03NTguNzM5IDc1OC42MjVjLTExMC4yMyAxMTAuMTE4LTI4OS4zNTUgMTEwLjAwNS0zOTkuMzYgMC0xMTAuMTE4LTExMC4xMTctMTEwLjAwNS0yODkuMjQyIDAtMzk5LjI0N2w4MzguNTg4LTgzOC41ODhjMTc1Ljk2My0xNzUuOTYyIDQ2Mi4zODItMTc2LjE4OCA2MzguOTA5IDAgMTc2LjA3NSAxNzYuMTg4IDE3Ni4wNzUgNDYyLjgzMyAwIDYzOC45MDhsLTc5OC42MDcgNzk4LjcyIDc5Ljg0OSA3OS44NSA3OTguNjA3LTc5OC43MmMyMjAuMDEtMjIwLjEyMyAyMjAuMDEtNTc4LjQ4NSAwLTc5OC42MDcnXG4gICAgICAgICAgICBmaWxsUnVsZT0nZXZlbm9kZCdcbiAgICAgICAgICAvPlxuICAgICAgICApO1xuICAgICAgY2FzZSBcImRpc2N1c3Npb25cIjpcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8cGF0aFxuICAgICAgICAgICAgZD0nTTY3Ny42NDcgMTZ2MzM4LjkzNmgxMTIuOTQxVjEyOS4wNTRoMTAxNi40N1Y5MTkuNTNoLTIyNS45OTR2MjU5Ljc2NUwxMzIxLjQxMiA5MTkuNTNoLTc5LjE3MlY0NjcuODc4SDB2MTAxNi40N2gzMzguNzF2NDE4LjlsNDE3Ljk5Ni00MTguOWg0ODUuNTM0di00NTEuODc3aDMyLjc1M2w0MTkuMTI1IDQxOS4xMjR2LTQxOS4xMjRIMTkyMFYxNkg2NzcuNjQ3Wk0zMzguNzkgOTE5LjU2M2g1NjQuNzA2di0xMTIuOTRIMzM4Ljc5djExMi45NFptMCAyMjUuODgzaDMzOC45MzZ2LTExMy4wNTRIMzM4Ljc5djExMy4wNTRabS0yMjUuODUtNTY0Ljc0aDEwMTYuNDd2NzkwLjcwMUg3MTAuNEw0NTEuNjUyIDE2MzEuMDZ2LTI1OS42NTJoLTMzOC43MVY1ODAuNzA2WidcbiAgICAgICAgICAgIGZpbGxSdWxlPSdldmVub2RkJ1xuICAgICAgICAgIC8+XG4gICAgICAgICk7XG4gICAgICBjYXNlIFwiZXh0ZXJuYWx0b29sXCI6IC8vIFwiZXh0ZXJuYWx0b29sXCIgaXMgdGhlIGljb24gZm9yIGV4dGVybmFsIHRvb2xzIGluIENhbnZhc1xuICAgICAgY2FzZSBcImV4dGVybmFsdXJsXCI6IC8vIFwibGlua1wiIGlzIHRoZSBpY29uIGZvciBleHRlcm5hbCBsaW5rcyBpbiBDYW52YXNcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8cGF0aFxuICAgICAgICAgICAgZD0nTTE4NjYuMDAzIDM1MS41NjMgMTU2NS4xMjggNTAuNTc1Yy02OS40Ni02Ny42NTItMTgwLjkzMi02Ny40MjYtMjQ4LjkyMy41NjVMOTA2LjIzIDQ2MS4xMTZjLTY4LjMzIDY4LjQ0My02OC4zMyAxNzkuNjkuMTEzIDI0OC4xMzJsMzEuNjIzIDMxLjYyNCA3OS43MzctNzkuOTYzLTMxLjYyNC0zMS41MWMtMjQuMjgyLTI0LjM5Ni0yNC4yODItNjQuMDM4IDAtODguNDMzbDQwOS45NzctNDA5Ljk3N2MyNC41MDgtMjQuMzk1IDY0LjgyOC0yNC4xNyA4OS42NzUgMGwyOTkuODU5IDI5OS45NzJjMjQuNzM0IDI1LjE4NiAyNC44NDcgNjUuNjE5LjU2NCA5MC4wMTRsLTQwOS45NzYgNDA5Ljk3N2MtMjQuNTA4IDI0LjI4Mi02NC4xNSAyNC4yODItODguNTQ2IDBsLTExMC43OTUtMTEwLjkwOSAxNTkuNDczLTE1OS4zNi03OS44NS03OS44NS00MzUuNjE0IDQzNS41MDItMTA5Ljc3OS0xMDkuNzc5Yy0zMi44NjYtMzMuNjU2LTc2LjgtNTIuMjkyLTEyMy42Ny01Mi42My00My41OTYgMS42OTQtOTIuMjczIDE4LjI5Ni0xMjYuMTU2IDUyLjE3OEw1MS4zNzcgMTMxNi4wODFjLTY4LjQ0MiA2OC40NDItNjguNDQyIDE3OS42OSAwIDI0OC4xMzJsMzAxLjU1MyAzMDEuNTUzYzM0LjEwOCAzNC4xMDggNzkuMDU5IDUxLjI3NSAxMjQuMDEgNTEuMjc1IDQ0Ljk1IDAgODkuOS0xNy4xNjcgMTI0LjEyMi01MS4yNzVsNDA5Ljk3Ni00MDkuOTc3YzMzLjc3LTMzLjg4MiA1Mi40MDUtNzguNjA3IDUyLjA2Ni0xMjYuMDQyLS4yMjYtNDYuOTg0LTE4Ljk3NC05MC45MTgtNTIuMDY2LTEyMy4yMTlsLTMwLjQ5NC0zMC40OTQtNzkuODUgNzkuODUgMzAuOTQ2IDMwLjk0NWMxMS44NiAxMS42MzMgMTguNDEgMjcuMTA2IDE4LjUyMyA0My41OTUuMTEzIDE2Ljk0Mi02LjY2NCAzMy4wOTItMTguOTc0IDQ1LjUxNmwtNDA5Ljk3NyA0MDkuOTc2Yy0yMy40OTIgMjMuNDkyLTY0Ljk0IDIzLjQ5Mi04OC40MzMgMGwtMzAxLjU1My0zMDEuNTUzYy0xMS43NDYtMTEuNzQ2LTE4LjE4My0yNy40NDQtMTguMTgzLTQ0LjI3MyAwLTE2LjcxNSA2LjQzNy0zMi40MTQgMTguMTgzLTQ0LjE2bDQwOS45NzctNDA5Ljk3NmMxMi4xOTctMTIuMzEgMjguMjM1LTE5LjA4NyA0NS4wNjMtMTkuMDg3aC40NTJjMTYuNDkuMTEzIDMxLjk2MiA2LjY2MyA0My45MzQgMTkuMDg3bDExMC4zNDQgMTEwLjIzLTE2Mi4xODQgMTYyLjI5NyA3OS44NSA3OS44NSA0MzguMzI0LTQzOC40MzggMTEwLjc5NiAxMTAuOTA4YzM0LjMzNCAzNC4yMjEgNzkuMTcxIDUxLjI3NSAxMjQuMTIyIDUxLjI3NSA0NC45NSAwIDg5LjkwMS0xNy4wNTQgMTI0LjEyMi01MS4yNzVsNDA5Ljk3Ny00MDkuOTc3YzY3Ljg3Ny02Ny45OSA2Ny45OS0xNzkuNDYzIDAtMjQ5LjI2J1xuICAgICAgICAgICAgZmlsbFJ1bGU9J2V2ZW5vZGQnXG4gICAgICAgICAgLz5cbiAgICAgICAgKTtcbiAgICAgIGNhc2UgXCJwYWdlXCI6IC8vIFwiZG9jdW1lbnRcIiBpcyB0aGUgaWNvbiBmb3IgcGFnZXMgaW4gQ2FudmFzXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgIGQ9J00xNzA2LjIzNSAxODA3LjA1OUgzNTAuOTQxVjExMi45NGg5MDMuNTN2NDUxLjc2NWg0NTEuNzY0djEyNDIuMzUzWm0tMzM4LjgyMy0xNjcwLjc0IDMxNS40NDMgMzE1LjQ0N2gtMzE1LjQ0M1YxMzYuMzJabTQwMi4xODIgMjQyLjQ4N0wxNDQwLjM3MiA0OS41OEMxNDA4LjI5NiAxNy42MiAxMzY1LjcxNyAwIDEzMjAuNTQyIDBIMjM4djE5MjBoMTU4MS4xNzVWNDk4LjYzNWMwLTQ1LjE3Ni0xNy42MTgtODcuNzU1LTQ5LjU4LTExOS44M1pNNTc2LjgyMyAxMjQyLjM1M2g3OTAuNTg5di0xMTIuOTRINTc2LjgyM3YxMTIuOTRabTAtNDUxLjc2NWg5MDMuNTNWNjc3LjY0N2gtOTAzLjUzdjExMi45NDFabTAgNjc3LjY0N2g0NTEuNzY1di0xMTIuOTQxSDU3Ni44MjN2MTEyLjk0MVptMC00NTEuNzY0aDY3Ny42NDhWOTAzLjUzSDU3Ni44MjN2MTEyLjk0MVptMC00NTEuNzY1aDQ1MS43NjVWNDUxLjc2NUg1NzYuODIzdjExMi45NDFaJ1xuICAgICAgICAgICAgZmlsbFJ1bGU9J2V2ZW5vZGQnXG4gICAgICAgICAgLz5cbiAgICAgICAgKTtcbiAgICAgIGNhc2UgXCJxdWl6XCI6IC8vIGV4dGVybmFsdG9vbFxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIDxnIGZpbGxSdWxlPSdldmVub2RkJz5cbiAgICAgICAgICAgIDxwYXRoIGQ9J203NDYuMjU1IDE0NjYuNzY0IDgwLjQ4NCA4MC43MTItMjQ4Ljc0OCAyNDguNjM0LTgwLjQ4NC04MC41OTggMjQ4Ljc0OC0yNDguNzQ4Wm0tMTY1LjkwNC0xNjUuODM2IDgwLjU5OCA4MC41OTgtMzMxLjYyNiAzMzEuNjI2LTgwLjU5OC04MC41OTggMzMxLjYyNi0zMzEuNjI2Wm0tMTY1Ljg0Ny0xNjUuNzIxIDgwLjU5OCA4MC41OTgtNDE0LjUwNCA0MTQuNTA0TDAgMTU0OS43MWw0MTQuNTA0LTQxNC41MDRaTTExMTkuMzIgMjY0LjZjMzU2LjQ3OC0zNTYuNDc4IDcyNS4yNjgtMTc4LjI5NiA3MjkuMDMtMTc2LjQ3MmwxNy4xIDguNDM2IDguNDM2IDE3LjFjMS44MjQgMy42NDggMTgwLjAwNiAzNzIuNDM4LTE3Ni41ODYgNzI5LjAzbC0xNDYuNjA0IDE0Ni42MDQtMi42MjIgNjY1Ljg3NC0yMjIuNjQyIDIyMi42NDItMzMxLjYyNi0zMzEuNTEyLTU3OC4wOTQtNTc4LjA5NC0zMzEuNjI2LTMzMS43NCAyMjIuNjQyLTIyMi42NDIgNjY1Ljg3NC0yLjUwOFptMzE2LjkyIDgzOS4xNTQtMzYxLjgzNiAzNjEuOTUgMjUxLjAyOCAyNTAuOTE0IDEwOC44Ny0xMDguODcgMS45MzgtNTAzLjk5NFptMzQzLjAyNi05MjEuMzQ4Yy02OS4wODQtMjUuOTkyLTMyMS4zNjYtOTUuMzA0LTU3OS4zNDggMTYyLjc5MmwtNjIzLjAxIDYyMy4wMSA0MTYuODk4IDQxNi44OTggNjIyLjg5Ni02MjMuMDFjMjU2Ljk1Ni0yNTYuOTU2IDE4Ny45ODYtNTExLjE3NiAxNjIuNTY0LTU3OS42OVptLTkyMS4xMiAzNDMuMzY4LTUwMy45OTQgMS44MjQtMTA4Ljg3IDEwOC44N0w0OTYuMzEgODg3LjYxbDM2MS44MzYtMzYxLjgzNlonIC8+XG4gICAgICAgICAgICA8cGF0aCBkPSdNMTUzNC45ODcgMzcyLjU1OGMtNTEuMDcyLTEuMzY4LTEzMS42NyAxMi43NjgtMjEzLjI5NCA5NC4zOTJsLTQwLjQ3IDQwLjM1NiAxNzMuMzk0IDE3My4yOCA0MC4zNTYtNDAuMjQyYzgyLjE5NC04Mi4zMDggOTYuOS0xNjEuMzEgOTQuODQ4LTIxMy4xOGwtMi4xNjYtNTIuNTU0LTUyLjY2OC0yLjA1MlonIC8+XG4gICAgICAgICAgPC9nPlxuICAgICAgICApO1xuICAgICAgY2FzZSBcInN1YmhlYWRlclwiOiAvLyBUaGVyZSBpcyBubyBpY29uIGZvciBzdWJoZWFkZXJzIGluIENhbnZhcywgc28gd2UgcmV0dXJuIGFuIGVtcHR5IGZyYWdtZW50LCBhbGxvd2luZyBjc3MgdG8gZGlzcGxheTogbm9uZSB0aGUgcGFyZW50J3MgcGFyZW50IGRpdi5cbiAgICAgICAgcmV0dXJuIDw+PC8+O1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8cGF0aFxuICAgICAgICAgICAgZD0nTTE0NjguMjE0IDB2NTY0LjY5OGgtMTEyLjk0VjExMi45NEgxMTIuOTR2MTY5NC4wOTJoMTI0Mi4zMzR2LTIyNS44NzloMTEyLjk0djMzOC44MTlIMFYwaDE0NjguMjE0Wm0xMjkuNDI4IDU4MS4zMTFjMjIuMTM3LTIyLjEzNiA1Ny44MjUtMjIuMTM2IDc5Ljk2MiAwbDIyNS44NzkgMjI1Ljg3OWMyMi4wMjMgMjIuMDIzIDIyLjAyMyA1Ny43MTIgMCA3OS44NDhsLTY3Ny42MzggNjc3LjYzN2MtMTAuNjE2IDEwLjUwNC0yNC45NiAxNi40OS0zOS45OCAxNi40OWgtMjI1Ljg4Yy0zMS4xNyAwLTU2LjQ2OS0yNS4yOTktNTYuNDY5LTU2LjQ3di0yMjUuODhjMC0xNS4wMiA1Ljk4Ni0yOS4zNjQgMTYuNDktMzkuODY3Wm0tMTU1LjI5MSAzMTQuOTg4LTQyNS44OTUgNDI1Ljg5NXYxNDYuMDMxaDE0Ni4wM2w0MjUuODk1LTQyNS44OTUtMTQ2LjAzLTE0Ni4wM1ptLTc2NC43MTQgMzQ2LjA0N3YxMTIuOTRIMzM4Ljgydi0xMTIuOTRoMzM4LjgxOFptMjI1Ljg4LTIyNS44OHYxMTIuOTRIMzM4LjgxOHYtMTEyLjk0aDU2NC42OTdabTczNC4xMDYtMzE1LjQ0LTExNS40MjQgMTE1LjQyNSAxNDYuMDMgMTQ2LjAzIDExNS40MjUtMTE1LjQyMy0xNDYuMDMxLTE0Ni4wMzFaTTExMjkuMzk1IDMzOC44M3Y0NTEuNzU4SDMzOC44MlYzMzguODNoNzkwLjU3NlptLTExMi45NCAxMTIuOTRINDUxLjc1OXYyMjUuODc4aDU2NC42OThWNDUxLjc3WidcbiAgICAgICAgICAgIGZpbGxSdWxlPSdldmVub2RkJ1xuICAgICAgICAgIC8+XG4gICAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT0nY2FudmFzLWl0ZW0taWNvbic+XG4gICAgICA8c3ZnXG4gICAgICAgIHdpZHRoPScxNidcbiAgICAgICAgaGVpZ2h0PScxNidcbiAgICAgICAgdmlld0JveD0nMCAwIDE5MjAgMTkyMCdcbiAgICAgICAgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJ1xuICAgICAgICBzdHlsZT17eyBmaWxsOiBpc01vZHVsZUl0ZW0gPyBcIiMwMzg5M2RcIiA6IFwiIzQ3NTM1Y1wiIH19XG4gICAgICA+XG4gICAgICAgIHtnZXRQYXRoRGF0YShpY29uX3R5cGUpfVxuICAgICAgPC9zdmc+XG4gICAgPC9kaXY+XG4gICk7XG59XG4iLCIvKipcbiAqIFJlbmRlcnMgdGhlIHN1Ym1pc3Npb24gZm9yIGFuIGFzc2lnbm1lbnQuXG4gKiBAcGFyYW0ge09iamVjdH0gYXNzaWdubWVudCAtIFRoZSBhc3NpZ25tZW50IHRvIHJlbmRlciB0aGUgc3VibWlzc2lvbiBmb3IuXG4gKiBAcmV0dXJucyB7SlNYLkVsZW1lbnR8bnVsbH0gVGhlIHN1Ym1pc3Npb24gY29tcG9uZW50LlxuICovXG5mdW5jdGlvbiBDYW52YXNTdWJtaXNzaW9uKHsgYXNzaWdubWVudCB9KSB7XG4gIGNvbnN0IHsgZGlySGFuZGxlIH0gPSB1c2VDb3Vyc2VDb250ZXh0KCk7XG5cbiAgaWYgKCFhc3NpZ25tZW50IHx8ICFhc3NpZ25tZW50LnN1Ym1pc3Npb24pIHtcbiAgICByZXR1cm4gPGRpdiBzdHlsZT17eyBwYWRkaW5nOiBcIjFyZW1cIiwgY29sb3I6IFwiIzZiNzI4MFwiIH19Pk5vIHN1Ym1pc3Npb24gZGF0YSBhdmFpbGFibGUuPC9kaXY+O1xuICB9XG5cbiAgLy8gSWYgd2UgYXJlIGxvb2tpbmcgYXQgYW4gYXNzaWdubWVudCBidXQgaGF2ZW4ndCByZS1hdXRoZW50aWNhdGVkIHRoZSBmb2xkZXIgaGFuZGxlIHlldFxuICBpZiAoIWRpckhhbmRsZSkge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2XG4gICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgcGFkZGluZzogXCIxLjVyZW1cIixcbiAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiI2ZmZjNjZFwiLFxuICAgICAgICAgIGNvbG9yOiBcIiM4NTY0MDRcIixcbiAgICAgICAgICBib3JkZXI6IFwiMXB4IHNvbGlkICNmZmVlYmFcIixcbiAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiMC4yNXJlbVwiLFxuICAgICAgICAgIG1hcmdpblRvcDogXCIxcmVtXCIsXG4gICAgICAgIH19XG4gICAgICA+XG4gICAgICAgIDxzdHJvbmc+UGVybWlzc2lvbiBSZXF1aXJlZDo8L3N0cm9uZz4gV2UgbmVlZCBwZXJtaXNzaW9uIHRvIHJlYWQgeW91ciBsb2NhbCBmaWxlcyB0byBzaG93IHN1Ym1pc3Npb25zLiBQbGVhc2Ugc2VsZWN0IHlvdXIgZm9sZGVyXG4gICAgICAgIGZyb20gdGhlIERhc2hib2FyZCBhZ2Fpbi5cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH1cblxuICBjb25zdCB7IHN1Ym1pc3Npb24gfSA9IGFzc2lnbm1lbnQ7XG5cbiAgY29uc3QgcmVuZGVyU3VibWlzc2lvbkJvZHkgPSAoKSA9PiB7XG4gICAgc3dpdGNoIChzdWJtaXNzaW9uLnN1Ym1pc3Npb25fdHlwZSkge1xuICAgICAgY2FzZSBcIm9ubGluZV91cGxvYWRcIjpcbiAgICAgICAgaWYgKCFzdWJtaXNzaW9uLmF0dGFjaG1lbnRzIHx8IHN1Ym1pc3Npb24uYXR0YWNobWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIDxwIHN0eWxlPXt7IGNvbG9yOiBcIiM2YjcyODBcIiB9fT5ObyBmaWxlcyB3ZXJlIGF0dGFjaGVkIHRvIHRoaXMgc3VibWlzc2lvbi48L3A+O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgIHtzdWJtaXNzaW9uLmF0dGFjaG1lbnRzLm1hcCgoYXR0YWNobWVudCkgPT4gKFxuICAgICAgICAgICAgICA8TG9jYWxBdHRhY2htZW50Vmlld2VyIGtleT17YXR0YWNobWVudC5pZH0gYXR0YWNobWVudD17YXR0YWNobWVudH0gYXNzaWdubWVudD17YXNzaWdubWVudH0gLz5cbiAgICAgICAgICAgICkpfVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICApO1xuXG4gICAgICBjYXNlIFwib25saW5lX3RleHRfZW50cnlcIjpcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBwYWRkaW5nOiBcIjFyZW1cIixcbiAgICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcIiNmZmZcIixcbiAgICAgICAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCAjZTVlN2ViXCIsXG4gICAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCIwLjI1cmVtXCIsXG4gICAgICAgICAgICAgIGJveFNoYWRvdzogXCIwIDFweCAycHggcmdiYSgwLDAsMCwwLjA1KVwiLFxuICAgICAgICAgICAgICBvdmVyZmxvd1g6IFwiYXV0b1wiLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICAgIGRhbmdlcm91c2x5U2V0SW5uZXJIVE1MPXt7IF9faHRtbDogc3VibWlzc2lvbi5ib2R5IH19XG4gICAgICAgICAgLz5cbiAgICAgICAgKTtcblxuICAgICAgY2FzZSBcIm9ubGluZV91cmxcIjpcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBwYWRkaW5nOiBcIjFyZW1cIixcbiAgICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcIiNmZmZcIixcbiAgICAgICAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCAjZTVlN2ViXCIsXG4gICAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCIwLjI1cmVtXCIsXG4gICAgICAgICAgICAgIGJveFNoYWRvdzogXCIwIDFweCAycHggcmdiYSgwLDAsMCwwLjA1KVwiLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICA8cCBzdHlsZT17eyBtYXJnaW46IFwiMCAwIDAuNXJlbSAwXCIsIGNvbG9yOiBcIiM0YjU1NjNcIiB9fT5TdWJtaXR0ZWQgVVJMOjwvcD5cbiAgICAgICAgICAgIDxhXG4gICAgICAgICAgICAgIGhyZWY9e3N1Ym1pc3Npb24udXJsfVxuICAgICAgICAgICAgICB0YXJnZXQ9J19ibGFuaydcbiAgICAgICAgICAgICAgcmVsPSdub29wZW5lciBub3JlZmVycmVyJ1xuICAgICAgICAgICAgICBzdHlsZT17eyBjb2xvcjogXCIjMjU2M2ViXCIsIHRleHREZWNvcmF0aW9uOiBcIm5vbmVcIiwgd29yZEJyZWFrOiBcImJyZWFrLWFsbFwiIH19XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIHtzdWJtaXNzaW9uLnVybH1cbiAgICAgICAgICAgIDwvYT5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKTtcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBwYWRkaW5nOiBcIjFyZW1cIixcbiAgICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcIiNmZWZjZThcIixcbiAgICAgICAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCAjZmVmMDhhXCIsXG4gICAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCIwLjI1cmVtXCIsXG4gICAgICAgICAgICAgIGNvbG9yOiBcIiM4NTRkMGVcIixcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgPlxuICAgICAgICAgICAgVW5zdXBwb3J0ZWQgc3VibWlzc2lvbiB0eXBlOiB7c3VibWlzc2lvbi5zdWJtaXNzaW9uX3R5cGV9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICk7XG4gICAgfVxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPGRpdlxuICAgICAgc3R5bGU9e3tcbiAgICAgICAgbWF4V2lkdGg6IFwiNTZyZW1cIixcbiAgICAgICAgbWFyZ2luOiBcIjFlbSAwXCIsXG4gICAgICAgIHBhZGRpbmc6IFwiMS41cmVtXCIsXG4gICAgICAgIGJhY2tncm91bmRDb2xvcjogXCIjZjlmYWZiXCIsXG4gICAgICAgIGJvcmRlclJhZGl1czogXCI4cHhcIixcbiAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCAjZThlYWVjXCIsXG4gICAgICB9fVxuICAgID5cbiAgICAgIDxoZWFkZXIgc3R5bGU9e3sgbWFyZ2luQm90dG9tOiBcIjEuNXJlbVwiLCBib3JkZXJCb3R0b206IFwiMXB4IHNvbGlkICNlNWU3ZWJcIiwgcGFkZGluZ0JvdHRvbTogXCIxcmVtXCIgfX0+XG4gICAgICAgIDxoMyBzdHlsZT17eyBmb250U2l6ZTogXCIxLjI1cmVtXCIsIGZvbnRXZWlnaHQ6IFwiYm9sZFwiLCBjb2xvcjogXCIjMTExODI3XCIsIG1hcmdpbjogXCIwIDAgMC41cmVtIDBcIiB9fT5TdWJtaXNzaW9uPC9oMz5cbiAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiBcImZsZXhcIiwgZ2FwOiBcIjFyZW1cIiwgZm9udFNpemU6IFwiMC44NzVyZW1cIiwgY29sb3I6IFwiIzRiNTU2M1wiLCBmbGV4V3JhcDogXCJ3cmFwXCIgfX0+XG4gICAgICAgICAgPHAgc3R5bGU9e3sgbWFyZ2luOiAwIH19PlxuICAgICAgICAgICAgU3RhdHVzOiA8c3BhbiBzdHlsZT17eyBmb250V2VpZ2h0OiBcIjYwMFwiLCB0ZXh0VHJhbnNmb3JtOiBcImNhcGl0YWxpemVcIiB9fT57c3VibWlzc2lvbi53b3JrZmxvd19zdGF0ZX08L3NwYW4+XG4gICAgICAgICAgPC9wPlxuICAgICAgICAgIDxwIHN0eWxlPXt7IG1hcmdpbjogMCB9fT5TdWJtaXR0ZWQ6IHtuZXcgRGF0ZShzdWJtaXNzaW9uLnN1Ym1pdHRlZF9hdCkudG9Mb2NhbGVTdHJpbmcoKX08L3A+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9oZWFkZXI+XG5cbiAgICAgIDxzZWN0aW9uPntyZW5kZXJTdWJtaXNzaW9uQm9keSgpfTwvc2VjdGlvbj5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cbiIsIi8qKlxuICogQ29sbGFwc2libGUgVGFibGUgQ29tcG9uZW50XG4gKiBAcGFyYW0ge09iamVjdH0gcHJvcHNcbiAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wcy50aXRsZSAtIFRoZSB0aXRsZSBvZiB0aGUgY29sbGFwc2libGUgdGFibGUuXG4gKiBAcGFyYW0ge1JlYWN0LlJlYWN0Tm9kZX0gcHJvcHMuY2hpbGRyZW4gLSBUaGUgY29udGVudCB0byBiZSBkaXNwbGF5ZWQgaW5zaWRlLlxuICogQHBhcmFtIHtSZWFjdC5DU1NQcm9wZXJ0aWVzfSBwcm9wcy5zdHlsZSAtIFRoZSBzdHlsZSB0byBiZSBhcHBsaWVkIHRvIHRoZSBjb2xsYXBzaWJsZSB0YWJsZS5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gcHJvcHMuaXNNb2R1bGVJdGVtIC0gV2hldGhlciB0aGUgdGFibGUgaXMgYSBtb2R1bGUgaXRlbS5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gcHJvcHMuaXNPcGVuIC0gV2hldGhlciB0aGUgdGFibGUgaXMgb3Blbi5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IHByb3BzLm9uVG9nZ2xlIC0gVGhlIGZ1bmN0aW9uIHRvIGNhbGwgd2hlbiB0aGUgdGFibGUgaXMgdG9nZ2xlZC5cbiAqL1xuZnVuY3Rpb24gQ29sbGFwc2VUYWJsZSh7IHRpdGxlLCBjaGlsZHJlbiwgc3R5bGUsIGlzTW9kdWxlSXRlbSwgaXNPcGVuOiBjb250cm9sbGVkSXNPcGVuLCBvblRvZ2dsZSB9KSB7XG4gIC8vIEZhbGxiYWNrIGludGVybmFsIHN0YXRlIGZvciBzdGFuZGFsb25lIHVzYWdlIG91dHNpZGUgb2YgTW9kdWxlc1BhZ2VcbiAgY29uc3QgW2ludGVybmFsSXNPcGVuLCBzZXRJbnRlcm5hbElzT3Blbl0gPSB1c2VTdGF0ZSh0cnVlKTtcblxuICBjb25zdCBpc0NvbnRyb2xsZWQgPSB0eXBlb2YgY29udHJvbGxlZElzT3BlbiAhPT0gXCJ1bmRlZmluZWRcIjtcbiAgY29uc3QgaXNPcGVuID0gaXNDb250cm9sbGVkID8gY29udHJvbGxlZElzT3BlbiA6IGludGVybmFsSXNPcGVuO1xuXG4gIGNvbnN0IHRvZ2dsZU9wZW4gPSAoKSA9PiB7XG4gICAgaWYgKGlzQ29udHJvbGxlZCAmJiBvblRvZ2dsZSkge1xuICAgICAgb25Ub2dnbGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2V0SW50ZXJuYWxJc09wZW4oKHByZXYpID0+ICFwcmV2KTtcbiAgICB9XG4gIH07XG5cbiAgLy8gU2FmZSBub3JtYWxpemF0aW9uOiBDb252ZXJ0cyBzaW5nbGUgZWxlbWVudHMsIHN0cmluZ3MsIG9yIGFycmF5cyBpbnRvIGEgY2xlYW4gYXJyYXlcbiAgY29uc3QgY2hpbGRMaXN0ID0gUmVhY3QuQ2hpbGRyZW4udG9BcnJheShjaGlsZHJlbik7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT0nY29sbGFwc2UtdGFibGUnIHN0eWxlPXtzdHlsZX0+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT0nY29sbGFwc2UtdGFibGUtaGVhZGVyJyBvbkNsaWNrPXt0b2dnbGVPcGVufT5cbiAgICAgICAgPHNwYW5cbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgZm9udFNpemU6IFwiMTBweFwiLFxuICAgICAgICAgICAgbWFyZ2luTGVmdDogXCIxMnB4XCIsXG4gICAgICAgICAgICBkaXNwbGF5OiBcImlubGluZS1ibG9ja1wiLFxuICAgICAgICAgICAgdHJhbnNmb3JtOiBcInNjYWxlWSguNzUpXCIsXG4gICAgICAgICAgICB0cmFuc2Zvcm1PcmlnaW46IFwibWlkZGxlXCIsXG4gICAgICAgICAgfX1cbiAgICAgICAgPlxuICAgICAgICAgIHshaXNPcGVuID8gXCLilrJcIiA6IFwi4pa8XCJ9XG4gICAgICAgIDwvc3Bhbj5cbiAgICAgICAgPHNwYW4+e3RpdGxlfTwvc3Bhbj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICB7aXNPcGVuICYmIChcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9J2NvbGxhcHNlLXRhYmxlLWNvbnRlbnQnPlxuICAgICAgICAgIHtjaGlsZExpc3QubGVuZ3RoID4gMCA/IChcbiAgICAgICAgICAgIDx1bCBjbGFzc05hbWU9J2NvbGxhcHNlLXRhYmxlLWxpc3QnPlxuICAgICAgICAgICAgICB7Y2hpbGRMaXN0Lm1hcCgoY2hpbGQsIGluZGV4KSA9PiAoXG4gICAgICAgICAgICAgICAgPGxpXG4gICAgICAgICAgICAgICAgICBrZXk9e2NoaWxkLmtleSB8fCBpbmRleH1cbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT0nY29sbGFwc2UtdGFibGUtaXRlbSdcbiAgICAgICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgICAgIGJvcmRlckxlZnQ6IGlzTW9kdWxlSXRlbSA/IFwiNHB4IHNvbGlkICMwMzg5M2RcIiA6IFwiMXB4IHNvbGlkICNlOGVhZWNcIixcbiAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAge2NoaWxkfVxuICAgICAgICAgICAgICAgIDwvbGk+XG4gICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgPC91bD5cbiAgICAgICAgICApIDogKFxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J2NvbGxhcHNlLXRhYmxlLWVtcHR5Jz5ObyBpdGVtcyB0byBkaXNwbGF5LjwvZGl2PlxuICAgICAgICAgICl9XG4gICAgICAgIDwvZGl2PlxuICAgICAgKX1cbiAgICA8L2Rpdj5cbiAgKTtcbn1cbi8qKlxuICogUmVuZGVycyB0aGUgZGV0YWlscyBvZiBhIGxpc3QgaXRlbSBpbiBhIGNvbGxhcHNpYmxlIHRhYmxlLiBOb3Qgc3VyZSB3aHkgdGhlcmUgYXJlIHNvIG1hbnkgcHJvcHMuLi4gd2FzIG9uZSBvZiB0aGUgZmlyc3QgY29tcG9uZW50cy5cbiAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wcy50aXRsZSAtIFRoZSB0aXRsZSBvZiB0aGUgbGlzdCBpdGVtLlxuICogQHBhcmFtIHtib29sZWFufSBwcm9wcy5jbG9zZWQgLSBXaGV0aGVyIHRoZSBsaXN0IGl0ZW0gaXMgY2xvc2VkLlxuICogQHBhcmFtIHtzdHJpbmd9IHByb3BzLmR1ZURhdGUgLSBUaGUgZHVlIGRhdGUgb2YgdGhlIGxpc3QgaXRlbS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wcy5ncmFkZSAtIFRoZSBncmFkZSBvZiB0aGUgbGlzdCBpdGVtLlxuICogQHBhcmFtIHtzdHJpbmd9IHByb3BzLm1heEdyYWRlIC0gVGhlIG1heGltdW0gZ3JhZGUgb2YgdGhlIGxpc3QgaXRlbS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wcy5hc3NpZ25tZW50IC0gVGhlIGFzc2lnbm1lbnQgb2YgdGhlIGxpc3QgaXRlbS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wcy5wYWdlVXJsIC0gVGhlIHBhZ2UgVVJMIG9mIHRoZSBsaXN0IGl0ZW0uXG4gKiBAcGFyYW0ge2Jvb2xlYW59IHByb3BzLmlzTW9kdWxlSXRlbSAtIFdoZXRoZXIgdGhlIGxpc3QgaXRlbSBpcyBhIG1vZHVsZSBpdGVtLlxuICogQHBhcmFtIHtzdHJpbmd9IHByb3BzLnR5cGUgLSBUaGUgdHlwZSBvZiB0aGUgbGlzdCBpdGVtLlxuICogQHBhcmFtIHtudW1iZXJ9IHByb3BzLmluZGVudCAtIFRoZSBpbmRlbnQgb2YgdGhlIGxpc3QgaXRlbS5cbiAqL1xuZnVuY3Rpb24gQ29sbGFwc2VMaXN0SXRlbURldGFpbHMoeyB0aXRsZSwgY2xvc2VkLCBkdWVEYXRlLCBncmFkZSwgbWF4R3JhZGUsIGFzc2lnbm1lbnQsIHBhZ2VVcmwsIGlzTW9kdWxlSXRlbSwgdHlwZSwgaW5kZW50IH0pIHtcbiAgICAgIGNvbnN0IHsgbmF2aWdhdGVUb0Fzc2lnbm1lbnQsIG5hdmlnYXRlVG9QYWdlIH0gPSB1c2VOYXZpZ2F0aW9uKCk7XG4gICAgICBjb25zdCB7IHJlY29ubmVjdEZvbGRlciB9ID0gdXNlQ291cnNlQ29udGV4dCgpO1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgPGRpdlxuICAgICAgICAgIGNsYXNzTmFtZT0nYXNzaWdubWVudC1kZXRhaWxzJ1xuICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICAgIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsXG4gICAgICAgICAgICBwYWRkaW5nTGVmdDogYCR7aW5kZW50ICogMX1lbWAsXG4gICAgICAgICAgfX1cbiAgICAgICAgPlxuICAgICAgICAgIDxDYW52YXNJdGVtSWNvbiBpY29uX3R5cGU9e3R5cGU/LnRvTG93ZXJDYXNlKCl9IGlzTW9kdWxlSXRlbT17aXNNb2R1bGVJdGVtfSAvPlxuICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgIGNsYXNzTmFtZT0nYXNzaWdubWVudC1pbmZvJ1xuICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsXG4gICAgICAgICAgICAgIGZsZXhEaXJlY3Rpb246IFwiY29sdW1uXCIsXG4gICAgICAgICAgICAgIG1hcmdpbkxlZnQ6IFwiMGVtXCIsXG4gICAgICAgICAgICB9fVxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxoM1xuICAgICAgICAgICAgICBjbGFzc05hbWU9J2Fzc2lnbm1lbnQtaW5mby10aXRsZSdcbiAgICAgICAgICAgICAgc3R5bGU9e3sgZm9udFNpemU6IFwiMTZweFwiLCBtYXJnaW46IFwiMFwiLCBjb2xvcjogXCIjMjczNDUwXCIsIGN1cnNvcjogYXNzaWdubWVudCB8fCBwYWdlVXJsID8gXCJwb2ludGVyXCIgOiBcImRlZmF1bHRcIiB9fVxuICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVjb25uZWN0Rm9sZGVyKCk7XG4gICAgICAgICAgICAgICAgaWYgKGFzc2lnbm1lbnQ/LmlkKSB7XG4gICAgICAgICAgICAgICAgICBuYXZpZ2F0ZVRvQXNzaWdubWVudChhc3NpZ25tZW50LmlkKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHBhZ2VVcmwpIHtcbiAgICAgICAgICAgICAgICAgIG5hdmlnYXRlVG9QYWdlKHBhZ2VVcmwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAge3RpdGxlfVxuICAgICAgICAgICAgPC9oMz5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogYXNzaWdubWVudCAhPSB1bmRlZmluZWQgPyBcImluaGVyaXRcIiA6IFwibm9uZVwiIH19PlxuICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9J2Fzc2lnbm1lbnQtaW5mby1pdGVtJz5cbiAgICAgICAgICAgICAgICA8c3Ryb25nPntjbG9zZWQgPyBcIkNsb3NlZFwiIDogXCJPcGVuXCJ9PC9zdHJvbmc+XG4gICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPSdhc3NpZ25tZW50LWluZm8taXRlbSc+XG4gICAgICAgICAgICAgICAgPHN0cm9uZz5EdWU8L3N0cm9uZz4ge2R1ZURhdGV9XG4gICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgeyFhc3NpZ25tZW50Py5zdWJtaXNzaW9uX3R5cGVzPy5pbmNsdWRlcyhcIm5vbmVcIikgJiYgYXNzaWdubWVudD8uZ3JhZGluZ190eXBlID09IFwicG9pbnRzXCIgJiYgZ3JhZGUgJiYgbWF4R3JhZGUgJiYgKFxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT0nYXNzaWdubWVudC1pbmZvLWl0ZW0nPlxuICAgICAgICAgICAgICAgICAgPHN0cm9uZz57Z3JhZGV9PC9zdHJvbmc+L3ttYXhHcmFkZX0gcHRzXG4gICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgKTtcbiAgICB9XG4iLCIvKipcbiAqIFRha2VzIGEgdHlwZSBvZiBbXCJtaXNzaW5nXCIsIFwibGF0ZVwiXVxuICogcmV0dXJucyBhIHNwYW4gd2l0aCB0aGUgYXBwcm9wcmlhdGUgY29sb3IgYW5kIHRleHQgZm9yIHRoZSBjb250ZXh0IHBpbGwuXG4gKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFRoZSB0eXBlIG9mIGNvbnRleHQgcGlsbCB0byBkaXNwbGF5LlxuICogQHJldHVybnMge1JlYWN0LkNvbXBvbmVudH0gZWl0aGVyIHN0eWxlZCBtaXNzaW5nIG9yIGxhdGVcbiAqL1xuZnVuY3Rpb24gQ29udGV4dFBpbGwoeyB0eXBlIH0pIHtcbiAgY29uc3QgY29tbW9uU3R5bGVzID0ge1xuICAgIHBhZGRpbmc6IFwiMnB4IDZweFwiLFxuICAgIGJvcmRlclJhZGl1czogXCI0cHhcIixcbiAgICBmb250U2l6ZTogXCIxNHB4XCIsXG4gICAgZm9udFdlaWdodDogXCJsaWdodFwiLFxuICAgIHRleHRUcmFuc2Zvcm06IFwibG93ZXJjYXNlXCIsXG4gICAgYm9yZGVyUmFkaXVzOiBcIjk5OXJlbVwiLFxuICB9O1xuICBsZXQgYm9yZGVyQ29sb3IgPSB0eXBlID09PSBcIm1pc3NpbmdcIiA/IFwicmdiKDIzMCwgMzYsIDQxKVwiIDogdHlwZSA9PT0gXCJsYXRlXCIgPyBcInJnYig0MywgMTIyLCAxODgpXCIgOiBcIiNlMmUzZTVcIjtcbiAgbGV0IHRleHRDb2xvciA9IHR5cGUgPT09IFwibWlzc2luZ1wiID8gXCJyZ2IoMjMwLCAzNiwgNDEpXCIgOiB0eXBlID09PSBcImxhdGVcIiA/IFwicmdiKDQzLCAxMjIsIDE4OClcIiA6IFwiIzM4M2Q0MVwiO1xuXG4gIHJldHVybiAoXG4gICAgPHNwYW5cbiAgICAgIHN0eWxlPXt7XG4gICAgICAgIC4uLmNvbW1vblN0eWxlcyxcbiAgICAgICAgYm9yZGVyOiBgMXB4IHNvbGlkICR7Ym9yZGVyQ29sb3J9YCxcbiAgICAgICAgY29sb3I6IHRleHRDb2xvcixcbiAgICAgIH19XG4gICAgPlxuICAgICAge3R5cGV9XG4gICAgPC9zcGFuPlxuICApO1xufVxuIiwiLyoqXG4gKiBDb3Vyc2VMaXN0IGNvbXBvbmVudCB0aGF0IGRpc3BsYXlzIGEgbGlzdCBvZiBjb3Vyc2UgZWxlbWVudHMuIEl0IGNoZWNrcyBpZiB0aGUgZWxlbWVudHMgcHJvcCBpcyB2YWxpZCBhbmQgcmVuZGVycyBhIGxpc3Qgb2YgbGlua3MgdG8gdGhlIGNvdXJzZSBpdGVtcy5cbiAqIGVsZW1lbnRzOiB7a2V5OiBzdHJpbmcsIHRpdGxlOiBzdHJpbmd9W11cbiAqIGFjdGl2ZUtleTogc3RyaW5nXG4gKiBjYWxsYmFjazogZnVuY3Rpb25cbiAqL1xuZnVuY3Rpb24gQ291cnNlTGlzdCh7IGVsZW1lbnRzLCBhY3RpdmVLZXksIGNhbGxiYWNrIH0pIHtcbiAgaWYgKCFlbGVtZW50cyB8fCBlbGVtZW50cz8ubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgbGV0IGNvdXJzZVN1YnRpdGxlID0gXCJDb3Vyc2UgTWVudVwiO1xuICBjb25zdCB7IGNvdXJzZURhdGEgfSA9IHVzZUNvdXJzZUNvbnRleHQoKTtcblxuICBpZiAoY291cnNlRGF0YSkge1xuICAgIGNvdXJzZVN1YnRpdGxlID0gY291cnNlRGF0YT8ubWFuaWZlc3Q/LmNvdXJzZVRlcm0/Lm5hbWUgfHwgXCJDb3Vyc2UgTWVudVwiO1xuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICBjbGFzc05hbWU9J2NvdXJzZS1pdGVtLWxpc3QnXG4gICAgICBpZD0nY291cnNlX2l0ZW1fbGlzdCdcbiAgICAgIHN0eWxlPXt7XG4gICAgICAgIHBvc2l0aW9uOiBcInN0aWNreVwiLCAvLyBNYWtlcyBpdCBzdGlja3lcbiAgICAgICAgdG9wOiBcIjBweFwiLCAvLyBEaXN0YW5jZSBmcm9tIHRvcCBvZiBzY3JlZW4gd2hlbiBzY3JvbGxpbmdcbiAgICAgICAgbWF4SGVpZ2h0OiBcImNhbGMoMTAwdmggLSA0MHB4KVwiLCAvLyBPcHRpb25hbDogS2VlcHMgbG9uZyBtZW51cyBzY3JvbGxhYmxlIHdpdGhpbiB2aWV3cG9ydFxuICAgICAgICBvdmVyZmxvd1k6IFwiYXV0b1wiLCAvLyBPcHRpb25hbDogQWxsb3dzIHNjcm9sbGluZyBpbnNpZGUgc2lkZWJhciBpZiBtZW51IGlzIGxvbmdcbiAgICAgICAgZmxleFNocmluazogMCwgLy8gUHJldmVudHMgY29udGVudCBvbiB0aGUgcmlnaHQgZnJvbSBzcXVpc2hpbmcgdGhlIHNpZGViYXJcbiAgICAgICAgbWF4V2lkdGg6IFwiMTkycHhcIixcbiAgICAgIH19XG4gICAgPlxuICAgICAgPGRpdlxuICAgICAgICBjbGFzc05hbWU9J2NvdXNlX3N1YnRpdGxlJ1xuICAgICAgICBzdHlsZT17e1xuICAgICAgICAgIGZvbnRTaXplOiBcIjExcHhcIixcbiAgICAgICAgICBvdmVyZmxvdzogXCJoaWRkZW5cIixcbiAgICAgICAgICB0ZXh0T3ZlcmZsb3c6IFwiZWxsaXBzaXNcIixcbiAgICAgICAgICB3aGl0ZVNwYWNlOiBcIm5vd3JhcFwiLFxuICAgICAgICAgIG1hcmdpbjogXCIzZW0gMWVtIDBlbSAxLjVlbVwiLFxuICAgICAgICAgIHBhZGRpbmdSaWdodDogXCIxZW1cIixcbiAgICAgICAgICBjb2xvcjogXCIjMjczNTQwXCIsXG4gICAgICAgIH19XG4gICAgICA+XG4gICAgICAgIDxpPntjb3Vyc2VTdWJ0aXRsZX08L2k+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxuYXY+XG4gICAgICAgIDx1bCBpZD0nY291cnNlTGlzdCcgc3R5bGU9e3sgZGlzcGxheTogXCJibG9ja1wiLCBsaXN0U3R5bGU6IFwibm9uZVwiLCBwYWRkaW5nOiAwIH19PlxuICAgICAgICAgIHtlbGVtZW50cy5tYXAoKGVsZW1lbnQsIGluZGV4KSA9PiAoXG4gICAgICAgICAgICA8bGkgY2xhc3NOYW1lPXtgY291cnNlLWl0ZW0gJHthY3RpdmVLZXkgPT09IGVsZW1lbnQua2V5ID8gXCJhY3RpdmUtY291cnNlLWl0ZW1cIiA6IFwiXCJ9YH0ga2V5PXtlbGVtZW50LmtleSB8fCBpbmRleH0+XG4gICAgICAgICAgICAgIDxhXG4gICAgICAgICAgICAgICAgb25DbGljaz17KGUpID0+IHtcbiAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICAgIGhhbmRsZUNvdXJzZUl0ZW1DbGljayhlbGVtZW50LmtleSwgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgaHJlZj0nIydcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIHtlbGVtZW50LnRpdGxlfVxuICAgICAgICAgICAgICA8L2E+XG4gICAgICAgICAgICA8L2xpPlxuICAgICAgICAgICkpfVxuICAgICAgICA8L3VsPlxuICAgICAgPC9uYXY+XG4gICAgPC9kaXY+XG4gICk7XG59XG5cbi8qKlxuICogSGFuZGxlQ291cnNlSXRlbUNsaWNrIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIHdoZW4gYSBjb3Vyc2UgaXRlbSBpcyBjbGlja2VkLiBDdXJyZW50bHksIGl0IGRvZXMgbm90aGluZyBidXQgY2FuIGJlIGV4dGVuZGVkIHRvIGhhbmRsZSBuYXZpZ2F0aW9uIG9yIG90aGVyIGFjdGlvbnMuXG4gKiBrZXk6IHN0cmluZ1xuICogY2FsbGJhY2s6IGZ1bmN0aW9uXG4gKi9cbmZ1bmN0aW9uIGhhbmRsZUNvdXJzZUl0ZW1DbGljayhrZXksIGNhbGxiYWNrKSB7XG4gIGNvbnNvbGUubG9nKFwiQ291cnNlIGl0ZW0gY2xpY2tlZDpcIiwga2V5KTtcbiAgaWYgKGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2soa2V5KTtcbiAgfVxufVxuIiwiLyoqXG4gKiBDb3Vyc2UgcGlja2VyIGRpYWxvZyB0aGF0IGFsbG93cyB0aGUgdXNlciB0byBzZWxlY3QgYSBjb3Vyc2UgZm9sZGVyIGFuZCBsb2FkIHRoZSBjb3Vyc2UgZGF0YS4gVXRpbGl6ZXMgdGhlIENvdXJzZUNvbnRleHQgdG8gbWFuYWdlIHRoZSBjb3Vyc2UgZGF0YSBhbmQgcHJvY2Vzc2luZyBzdGF0ZS5cbiAqL1xuZnVuY3Rpb24gQ291cnNlUGlja2VyKCkge1xuICBjb25zdCB7IGhhbmRsZUZvbGRlclNlbGVjdCwgaXNQcm9jZXNzaW5nIH0gPSB1c2VDb3Vyc2VDb250ZXh0KCk7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT0nY291cnNlLXBpY2tlcic+XG4gICAgICA8aDE+V2VsY29tZSB0byB0aGUgT2ZmbGluZSBDb3Vyc2UgVmlld2VyPC9oMT5cbiAgICAgIDxwPlBsZWFzZSBzZWxlY3QgYSBjb3Vyc2UgZm9sZGVyIHRvIGJlZ2luLiBUaGUgZm9sZGVyIHNob3VsZCBjb250YWluIHRoZSBjb3Vyc2UgY29udGVudCBhbmQgbWV0YWRhdGEuPC9wPlxuICAgICAgPGJ1dHRvbiBvbkNsaWNrPXtoYW5kbGVGb2xkZXJTZWxlY3R9IGRpc2FibGVkPXtpc1Byb2Nlc3Npbmd9PlxuICAgICAgICB7aXNQcm9jZXNzaW5nID8gXCJQcm9jZXNzaW5nLi4uXCIgOiBcIlNlbGVjdCBDb3Vyc2UgRm9sZGVyXCJ9XG4gICAgICA8L2J1dHRvbj5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cbiIsIi8qKlxuICogVXNlcyBtYW1tb3RoIHRvIGNvbnZlcnQgZG9jIGFuZCBkb2N4IHRvIGxvY2FsIGF0dGF0Y2htZW50c1xuICogQHBhcmFtIHsqfSBmaWxlT2JqZWN0IC0gVGhlIGZpbGUgb2JqZWN0IHRvIGNvbnZlcnQuXG4gKiBAcGFyYW0geyp9IGZpbGVVcmwgLSBUaGUgVVJMIG9mIHRoZSBmaWxlIHRvIGNvbnZlcnQuXG4gKiBAcmV0dXJucyBUaGUgZG9jeCB2aWV3ZXIgY29tcG9uZW50IGZvciB0aGUgYXNzaWdubWVudC5cbiAqL1xuZnVuY3Rpb24gRG9jeE1lbW9yeVZpZXdlcih7IGZpbGVPYmplY3QsIGZpbGVVcmwgfSkge1xuICBjb25zdCBbaHRtbENvbnRlbnQsIHNldEh0bWxDb250ZW50XSA9IHVzZVN0YXRlKFwiXCIpO1xuICBjb25zdCBbbG9hZGluZywgc2V0TG9hZGluZ10gPSB1c2VTdGF0ZSh0cnVlKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGFzeW5jIGZ1bmN0aW9uIGNvbnZlcnREb2N4KCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgbGV0IGFycmF5QnVmZmVyID0gbnVsbDtcbiAgICAgICAgaWYgKGZpbGVPYmplY3QpIHtcbiAgICAgICAgICBhcnJheUJ1ZmZlciA9IGF3YWl0IGZpbGVPYmplY3QuYXJyYXlCdWZmZXIoKTtcbiAgICAgICAgfSBlbHNlIGlmIChmaWxlVXJsKSB7XG4gICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goZmlsZVVybCk7XG4gICAgICAgICAgYXJyYXlCdWZmZXIgPSBhd2FpdCByZXMuYXJyYXlCdWZmZXIoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWFycmF5QnVmZmVyKSByZXR1cm47XG4gICAgICAgIC8vIENvbnZlcnRzIGJpbmFyeSAuZG9jeCBkaXJlY3RseSB0byByYXcgSFRNTCBzdHJpbmdcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgd2luZG93Lm1hbW1vdGguY29udmVydFRvSHRtbCh7IGFycmF5QnVmZmVyIH0pO1xuICAgICAgICBzZXRIdG1sQ29udGVudChyZXN1bHQudmFsdWUpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJGYWlsZWQgdG8gcGFyc2UgZG9jeFwiLCBlcnIpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgc2V0TG9hZGluZyhmYWxzZSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChmaWxlT2JqZWN0IHx8IGZpbGVVcmwpIGNvbnZlcnREb2N4KCk7XG4gIH0sIFtmaWxlT2JqZWN0LCBmaWxlVXJsXSk7XG5cbiAgaWYgKGxvYWRpbmcpIHJldHVybiA8ZGl2PlBhcnNpbmcgZG9jdW1lbnQuLi48L2Rpdj47XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICBzdHlsZT17e1xuICAgICAgICBwYWRkaW5nOiBcIjEuNXJlbVwiLFxuICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiI2ZmZlwiLFxuICAgICAgICBib3JkZXI6IFwiMXB4IHNvbGlkICNlNWU3ZWJcIixcbiAgICAgICAgYm9yZGVyUmFkaXVzOiBcIjAuMjVyZW1cIixcbiAgICAgICAgbWF4SGVpZ2h0OiBcIjMwcmVtXCIsXG4gICAgICAgIG92ZXJmbG93WTogXCJhdXRvXCIsXG4gICAgICAgIHdpZHRoOiBcIjEwMCVcIixcbiAgICAgIH19XG4gICAgICBkYW5nZXJvdXNseVNldElubmVySFRNTD17eyBfX2h0bWw6IGh0bWxDb250ZW50IH19XG4gICAgLz5cbiAgKTtcbn0iLCIvKiogU3ViLWNvbXBvbmVudCB0byBoYW5kbGUgYXN5bmNocm9ub3VzIGZpbGUgbG9hZGluZyBhbmQgbWVtb3J5IGNsZWFudXBcbiAqIEBwYXJhbSB7T2JqZWN0fSBhdHRhY2htZW50IC0gVGhlIGF0dGFjaG1lbnQgb2JqZWN0XG4gKiBAcGFyYW0ge09iamVjdH0gYXNzaWdubWVudCAtIFRoZSBhc3NpZ25tZW50IG9iamVjdFxuICogQHBhcmFtIHtPYmplY3R9IGZpbGUgLSBUaGUgZmlsZSBvYmplY3RcbiAqIEByZXR1cm5zIHtSZWFjdC5Db21wb25lbnR9IFRoZSBsb2NhbCBhdHRhY2htZW50IHZpZXdlclxuICovXG5mdW5jdGlvbiBMb2NhbEF0dGFjaG1lbnRWaWV3ZXIoeyBhdHRhY2htZW50LCBhc3NpZ25tZW50LCBmaWxlIH0pIHtcbiAgY29uc3QgeyBkaXJIYW5kbGUsIGNvdXJzZURhdGEgfSA9IHVzZUNvdXJzZUNvbnRleHQoKTtcbiAgY29uc3QgW2ZpbGVVcmwsIHNldEZpbGVVcmxdID0gdXNlU3RhdGUobnVsbCk7XG4gIGNvbnN0IFtmaWxlT2JqZWN0LCBzZXRGaWxlT2JqZWN0XSA9IHVzZVN0YXRlKG51bGwpO1xuICBjb25zdCBbZXJyb3IsIHNldEVycm9yXSA9IHVzZVN0YXRlKG51bGwpO1xuICBjb25zdCBbaXNMb2FkaW5nLCBzZXRJc0xvYWRpbmddID0gdXNlU3RhdGUodHJ1ZSk7XG5cbiAgY29uc3QgdGFyZ2V0RmlsZSA9IGZpbGUgfHwgYXR0YWNobWVudDtcbiAgY29uc3QgcmF3RmlsZU5hbWUgPSB0YXJnZXRGaWxlID8gdGFyZ2V0RmlsZS5kaXNwbGF5X25hbWUgfHwgdGFyZ2V0RmlsZS5maWxlbmFtZSB8fCBcIlwiIDogXCJcIjtcbiAgY29uc3Qgc2FuaXRpemVkQXNzaWdubWVudE5hbWUgPSBhc3NpZ25tZW50ID8gc2FuaXRpemVGaWxlbmFtZShhc3NpZ25tZW50Lm5hbWUpIDogXCJcIjtcbiAgY29uc3Qgc2FuaXRpemVkRmlsZU5hbWUgPSBzYW5pdGl6ZUZpbGVuYW1lKHJhd0ZpbGVOYW1lKTtcblxuICAvLyBGZXRjaCB0aGUgZmlsZSBmcm9tIHRoZSBGaWxlIFN5c3RlbSBBUEkgYW5kIGNyZWF0ZSBhIHJlYWRhYmxlIFVSTFxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghdGFyZ2V0RmlsZSkge1xuICAgICAgc2V0RXJyb3IoXCJObyBmaWxlIHNwZWNpZmllZC5cIik7XG4gICAgICBzZXRJc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghZGlySGFuZGxlKSB7XG4gICAgICBzZXRFcnJvcihcIk5vIGRpcmVjdG9yeSBhY2Nlc3MuXCIpO1xuICAgICAgc2V0SXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsZXQgb2JqZWN0VXJsID0gbnVsbDtcblxuICAgIGFzeW5jIGZ1bmN0aW9uIGxvYWRMb2NhbEZpbGUoKSB7XG4gICAgICB0cnkge1xuICAgICAgICBzZXRJc0xvYWRpbmcodHJ1ZSk7XG4gICAgICAgIHNldEVycm9yKG51bGwpO1xuXG4gICAgICAgIGlmICghZGlySGFuZGxlKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gZGlyZWN0b3J5IGFjY2VzcyBoYW5kbGUgYXZhaWxhYmxlLlwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBtYXRjaGVkRmlsZUhhbmRsZSA9IG51bGw7XG5cbiAgICAgICAgaWYgKGFzc2lnbm1lbnQpIHtcbiAgICAgICAgICAvLyAxLiBBY2Nlc3MgdGhlIFwiU3VibWlzc2lvbnNcIiBkaXJlY3RvcnlcbiAgICAgICAgICBjb25zdCBzdWJtaXNzaW9uc0hhbmRsZSA9IGF3YWl0IGRpckhhbmRsZS5nZXREaXJlY3RvcnlIYW5kbGUoXCJTdWJtaXNzaW9uc1wiKTtcblxuICAgICAgICAgIC8vIFRhcmdldHMgZm9yIGFzc2lnbm1lbnQgZm9sZGVyXG4gICAgICAgICAgY29uc3QgdGFyZ2V0Rm9sZGVyU2FuaXRpemVkID0gc2FuaXRpemVGaWxlbmFtZShhc3NpZ25tZW50Lm5hbWUpLnRvTG93ZXJDYXNlKCkudHJpbSgpO1xuICAgICAgICAgIGNvbnN0IHRhcmdldEZvbGRlclJhdyA9IChhc3NpZ25tZW50Lm5hbWUgfHwgXCJcIikudG9Mb3dlckNhc2UoKS50cmltKCk7XG5cbiAgICAgICAgICBsZXQgYXNzaWdubWVudEhhbmRsZSA9IG51bGw7XG5cbiAgICAgICAgICAvLyAyLiBGSU5EIEFTU0lHTk1FTlQgRk9MREVSXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGFzc2lnbm1lbnRIYW5kbGUgPSBhd2FpdCBzdWJtaXNzaW9uc0hhbmRsZS5nZXREaXJlY3RvcnlIYW5kbGUodGFyZ2V0Rm9sZGVyU2FuaXRpemVkKTtcbiAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgZW50cnkgb2Ygc3VibWlzc2lvbnNIYW5kbGUudmFsdWVzKCkpIHtcbiAgICAgICAgICAgICAgaWYgKGVudHJ5LmtpbmQgPT09IFwiZGlyZWN0b3J5XCIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmb2xkZXJOYW1lID0gZW50cnkubmFtZS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICBjb25zdCBmb2xkZXJTYW5pdGl6ZWQgPSBzYW5pdGl6ZUZpbGVuYW1lKGVudHJ5Lm5hbWUpLnRvTG93ZXJDYXNlKCkudHJpbSgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgZm9sZGVyTmFtZSA9PT0gdGFyZ2V0Rm9sZGVyUmF3IHx8XG4gICAgICAgICAgICAgICAgICBmb2xkZXJOYW1lID09PSB0YXJnZXRGb2xkZXJTYW5pdGl6ZWQgfHxcbiAgICAgICAgICAgICAgICAgIGZvbGRlclNhbml0aXplZCA9PT0gdGFyZ2V0Rm9sZGVyU2FuaXRpemVkIHx8XG4gICAgICAgICAgICAgICAgICBmb2xkZXJOYW1lLmluY2x1ZGVzKHRhcmdldEZvbGRlclNhbml0aXplZCkgfHxcbiAgICAgICAgICAgICAgICAgIHRhcmdldEZvbGRlclNhbml0aXplZC5pbmNsdWRlcyhmb2xkZXJOYW1lKVxuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgYXNzaWdubWVudEhhbmRsZSA9IGVudHJ5O1xuICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKCFhc3NpZ25tZW50SGFuZGxlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2lnbm1lbnQgZm9sZGVyIG5vdCBmb3VuZCBmb3I6IFwiJHthc3NpZ25tZW50Lm5hbWV9XCJgKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBQcmVwYXJlIHRhcmdldCBmaWxlIHN0cmluZ3NcbiAgICAgICAgICBjb25zdCByYXdUYXJnZXQgPSAodGFyZ2V0RmlsZS5kaXNwbGF5X25hbWUgfHwgdGFyZ2V0RmlsZS5maWxlbmFtZSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcbiAgICAgICAgICBjb25zdCBzYW5pdGl6ZWRUYXJnZXQgPSBzYW5pdGl6ZUZpbGVuYW1lKHJhd1RhcmdldCkudG9Mb3dlckNhc2UoKS50cmltKCk7XG4gICAgICAgICAgY29uc3QgY3VycmVudEF0dGVtcHROdW1iZXIgPSBhc3NpZ25tZW50Py5zdWJtaXNzaW9uPy5hdHRlbXB0O1xuXG4gICAgICAgICAgY29uc3QgZXhwZWN0ZWRBdHRlbXB0UHJlZml4ID0gY3VycmVudEF0dGVtcHROdW1iZXIgPyBgYXR0ZW1wdCAke2N1cnJlbnRBdHRlbXB0TnVtYmVyfSAtIGAgOiBudWxsO1xuICAgICAgICAgIGNvbnN0IGF0dGVtcHRQcmVmaXhSZWdleCA9IC9eYXR0ZW1wdFxccytcXGQrXFxzKi1cXHMqL2k7XG5cbiAgICAgICAgICAvLyAzLiBTRUFSQ0ggRk9SIEFUVEFDSE1FTlQgRklMRSBJTiBBU1NJR05NRU5UIEZPTERFUlxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgZW50cnkgb2YgYXNzaWdubWVudEhhbmRsZS52YWx1ZXMoKSkge1xuICAgICAgICAgICAgaWYgKGVudHJ5LmtpbmQgPT09IFwiZmlsZVwiKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGRpc2tOYW1lUmF3ID0gZW50cnkubmFtZS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcbiAgICAgICAgICAgICAgY29uc3QgZGlza05hbWVTYW5pdGl6ZWQgPSBzYW5pdGl6ZUZpbGVuYW1lKGVudHJ5Lm5hbWUpLnRvTG93ZXJDYXNlKCkudHJpbSgpO1xuXG4gICAgICAgICAgICAgIGNvbnN0IGRpc2tOYW1lVW5wcmVmaXhlZFJhdyA9IGRpc2tOYW1lUmF3LnJlcGxhY2UoYXR0ZW1wdFByZWZpeFJlZ2V4LCBcIlwiKS50cmltKCk7XG4gICAgICAgICAgICAgIGNvbnN0IGRpc2tOYW1lVW5wcmVmaXhlZFNhbml0aXplZCA9IHNhbml0aXplRmlsZW5hbWUoZGlza05hbWVVbnByZWZpeGVkUmF3KS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcblxuICAgICAgICAgICAgICBjb25zdCBtYXRjaGVzRXhhY3RBdHRlbXB0UHJlZml4ID0gZXhwZWN0ZWRBdHRlbXB0UHJlZml4ICYmIGRpc2tOYW1lUmF3LnN0YXJ0c1dpdGgoZXhwZWN0ZWRBdHRlbXB0UHJlZml4KTtcblxuICAgICAgICAgICAgICBjb25zdCBpc01hdGNoID1cbiAgICAgICAgICAgICAgICAobWF0Y2hlc0V4YWN0QXR0ZW1wdFByZWZpeCAmJiBkaXNrTmFtZVVucHJlZml4ZWRTYW5pdGl6ZWQgPT09IHNhbml0aXplZFRhcmdldCkgfHxcbiAgICAgICAgICAgICAgICBkaXNrTmFtZVJhdyA9PT0gcmF3VGFyZ2V0IHx8XG4gICAgICAgICAgICAgICAgZGlza05hbWVSYXcgPT09IHNhbml0aXplZFRhcmdldCB8fFxuICAgICAgICAgICAgICAgIGRpc2tOYW1lU2FuaXRpemVkID09PSBzYW5pdGl6ZWRUYXJnZXQgfHxcbiAgICAgICAgICAgICAgICBkaXNrTmFtZVVucHJlZml4ZWRSYXcgPT09IHJhd1RhcmdldCB8fFxuICAgICAgICAgICAgICAgIGRpc2tOYW1lVW5wcmVmaXhlZFJhdyA9PT0gc2FuaXRpemVkVGFyZ2V0IHx8XG4gICAgICAgICAgICAgICAgZGlza05hbWVVbnByZWZpeGVkU2FuaXRpemVkID09PSBzYW5pdGl6ZWRUYXJnZXQgfHxcbiAgICAgICAgICAgICAgICBkaXNrTmFtZVVucHJlZml4ZWRSYXcucmVwbGFjZSgvXFwrL2csIFwiIFwiKSA9PT0gcmF3VGFyZ2V0IHx8XG4gICAgICAgICAgICAgICAgKGRpc2tOYW1lUmF3LmluY2x1ZGVzKHNhbml0aXplZFRhcmdldCkgJiYgZGlza05hbWVSYXcuZW5kc1dpdGgoc2FuaXRpemVkVGFyZ2V0LnNsaWNlKC01KSkpO1xuXG4gICAgICAgICAgICAgIGlmIChpc01hdGNoKSB7XG4gICAgICAgICAgICAgICAgbWF0Y2hlZEZpbGVIYW5kbGUgPSBlbnRyeTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICghbWF0Y2hlZEZpbGVIYW5kbGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRmlsZSBcIiR7cmF3VGFyZ2V0fVwiIG5vdCBmb3VuZCBpbiBmb2xkZXIgXCIke2Fzc2lnbm1lbnRIYW5kbGUubmFtZX1cImApO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyAtLS0gQ09VUlNFIEZJTEUgKEZpbGVzLy4uLikgTE9PS1VQIC0tLVxuICAgICAgICAgIGNvbnN0IGZpbGVzSGFuZGxlID0gYXdhaXQgZGlySGFuZGxlLmdldERpcmVjdG9yeUhhbmRsZShcIkZpbGVzXCIpO1xuXG4gICAgICAgICAgLy8gRGV0ZXJtaW5lIHN1YmZvbGRlciBwYXRoIGZyb20gZm9sZGVyX2lkIGluIGNvdXJzZURhdGEuRmlsZXMuZm9sZGVyc1xuICAgICAgICAgIGxldCBmb2xkZXJQYXRoUGFydHMgPSBbXTtcbiAgICAgICAgICBpZiAodGFyZ2V0RmlsZS5mb2xkZXJfaWQgJiYgY291cnNlRGF0YT8uRmlsZXM/LmZvbGRlcnMpIHtcbiAgICAgICAgICAgIGNvbnN0IGZvbGRlcnNBcnJheSA9IEFycmF5LmlzQXJyYXkoY291cnNlRGF0YS5GaWxlcy5mb2xkZXJzKVxuICAgICAgICAgICAgICA/IGNvdXJzZURhdGEuRmlsZXMuZm9sZGVyc1xuICAgICAgICAgICAgICA6IE9iamVjdC52YWx1ZXMoY291cnNlRGF0YS5GaWxlcy5mb2xkZXJzKTtcbiAgICAgICAgICAgIGNvbnN0IGZvbGRlck1hcCA9IG5ldyBNYXAoZm9sZGVyc0FycmF5Lm1hcCgoZikgPT4gW1N0cmluZyhmLmlkKSwgZl0pKTtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVGb2xkZXIgPSBmb2xkZXJNYXAuZ2V0KFN0cmluZyh0YXJnZXRGaWxlLmZvbGRlcl9pZCkpO1xuXG4gICAgICAgICAgICBpZiAoZmlsZUZvbGRlciAmJiBmaWxlRm9sZGVyLmZ1bGxfbmFtZSkge1xuICAgICAgICAgICAgICBsZXQgZm4gPSBmaWxlRm9sZGVyLmZ1bGxfbmFtZTtcbiAgICAgICAgICAgICAgaWYgKGZuLnRvTG93ZXJDYXNlKCkuc3RhcnRzV2l0aChcImNvdXJzZSBmaWxlc1wiKSkge1xuICAgICAgICAgICAgICAgIGZuID0gZm4uc2xpY2UoXCJjb3Vyc2UgZmlsZXNcIi5sZW5ndGgpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZvbGRlclBhdGhQYXJ0cyA9IGZuXG4gICAgICAgICAgICAgICAgLnNwbGl0KFwiL1wiKVxuICAgICAgICAgICAgICAgIC5tYXAoKHMpID0+IHMudHJpbSgpKVxuICAgICAgICAgICAgICAgIC5maWx0ZXIoQm9vbGVhbik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGZpbGVGb2xkZXIpIHtcbiAgICAgICAgICAgICAgY29uc3QgcGFydHMgPSBbXTtcbiAgICAgICAgICAgICAgbGV0IGN1cnIgPSBmaWxlRm9sZGVyO1xuICAgICAgICAgICAgICB3aGlsZSAoY3VyciAmJiBjdXJyLnBhcmVudF9mb2xkZXJfaWQgIT09IG51bGwgJiYgY3Vyci5uYW1lICE9PSBcImNvdXJzZSBmaWxlc1wiKSB7XG4gICAgICAgICAgICAgICAgcGFydHMudW5zaGlmdChjdXJyLm5hbWUpO1xuICAgICAgICAgICAgICAgIGN1cnIgPSBmb2xkZXJNYXAuZ2V0KFN0cmluZyhjdXJyLnBhcmVudF9mb2xkZXJfaWQpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmb2xkZXJQYXRoUGFydHMgPSBwYXJ0cztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBUcmF2ZXJzZSBpbnRvIHRhcmdldCBmb2xkZXIgaWYgc3BlY2lmaWVkXG4gICAgICAgICAgbGV0IHRhcmdldERpckhhbmRsZSA9IGZpbGVzSGFuZGxlO1xuICAgICAgICAgIGZvciAoY29uc3QgcGFydCBvZiBmb2xkZXJQYXRoUGFydHMpIHtcbiAgICAgICAgICAgIGxldCBuZXh0SGFuZGxlID0gbnVsbDtcbiAgICAgICAgICAgIGNvbnN0IHBhcnRSYXcgPSBwYXJ0LnRvTG93ZXJDYXNlKCkudHJpbSgpO1xuICAgICAgICAgICAgY29uc3QgcGFydFNhbml0aXplZCA9IHNhbml0aXplRmlsZW5hbWUocGFydCkudG9Mb3dlckNhc2UoKS50cmltKCk7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIG5leHRIYW5kbGUgPSBhd2FpdCB0YXJnZXREaXJIYW5kbGUuZ2V0RGlyZWN0b3J5SGFuZGxlKHBhcnQpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIG5leHRIYW5kbGUgPSBhd2FpdCB0YXJnZXREaXJIYW5kbGUuZ2V0RGlyZWN0b3J5SGFuZGxlKHNhbml0aXplRmlsZW5hbWUocGFydCkpO1xuICAgICAgICAgICAgICB9IGNhdGNoIChlMikge1xuICAgICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgZW50cnkgb2YgdGFyZ2V0RGlySGFuZGxlLnZhbHVlcygpKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoZW50cnkua2luZCA9PT0gXCJkaXJlY3RvcnlcIikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlbnRyeVJhdyA9IGVudHJ5Lm5hbWUudG9Mb3dlckNhc2UoKS50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVudHJ5U2FuaXRpemVkID0gc2FuaXRpemVGaWxlbmFtZShlbnRyeS5uYW1lKS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVudHJ5UmF3ID09PSBwYXJ0UmF3IHx8IGVudHJ5U2FuaXRpemVkID09PSBwYXJ0U2FuaXRpemVkIHx8IGVudHJ5U2FuaXRpemVkID09PSBzYW5pdGl6ZUZpbGVuYW1lKHBhcnRSYXcpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgbmV4dEhhbmRsZSA9IGVudHJ5O1xuICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChuZXh0SGFuZGxlKSB7XG4gICAgICAgICAgICAgIHRhcmdldERpckhhbmRsZSA9IG5leHRIYW5kbGU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCByYXdUYXJnZXQgPSAodGFyZ2V0RmlsZS5kaXNwbGF5X25hbWUgfHwgdGFyZ2V0RmlsZS5maWxlbmFtZSB8fCBcIlwiKS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcbiAgICAgICAgICBjb25zdCBzYW5pdGl6ZWRUYXJnZXQgPSBzYW5pdGl6ZUZpbGVuYW1lKHJhd1RhcmdldCkudG9Mb3dlckNhc2UoKS50cmltKCk7XG5cbiAgICAgICAgICAvLyBTZWFyY2ggaW5zaWRlIHRhcmdldERpckhhbmRsZVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgZW50cnkgb2YgdGFyZ2V0RGlySGFuZGxlLnZhbHVlcygpKSB7XG4gICAgICAgICAgICBpZiAoZW50cnkua2luZCA9PT0gXCJmaWxlXCIpIHtcbiAgICAgICAgICAgICAgY29uc3QgZGlza05hbWVSYXcgPSBlbnRyeS5uYW1lLnRvTG93ZXJDYXNlKCkudHJpbSgpO1xuICAgICAgICAgICAgICBjb25zdCBkaXNrTmFtZVNhbml0aXplZCA9IHNhbml0aXplRmlsZW5hbWUoZW50cnkubmFtZSkudG9Mb3dlckNhc2UoKS50cmltKCk7XG4gICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICBkaXNrTmFtZVJhdyA9PT0gcmF3VGFyZ2V0IHx8XG4gICAgICAgICAgICAgICAgZGlza05hbWVSYXcgPT09IHNhbml0aXplZFRhcmdldCB8fFxuICAgICAgICAgICAgICAgIGRpc2tOYW1lU2FuaXRpemVkID09PSBzYW5pdGl6ZWRUYXJnZXQgfHxcbiAgICAgICAgICAgICAgICBkaXNrTmFtZVJhdy5yZXBsYWNlKC9cXCsvZywgXCIgXCIpID09PSByYXdUYXJnZXQgfHxcbiAgICAgICAgICAgICAgICBkaXNrTmFtZVNhbml0aXplZC5yZXBsYWNlKC9cXCsvZywgXCIgXCIpID09PSBzYW5pdGl6ZWRUYXJnZXRcbiAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgbWF0Y2hlZEZpbGVIYW5kbGUgPSBlbnRyeTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEZhbGxiYWNrIDE6IFNlYXJjaCB0b3AtbGV2ZWwgRmlsZXMgZGlyZWN0b3J5IGlmIHRhcmdldERpckhhbmRsZSB3YXMgYSBzdWJmb2xkZXJcbiAgICAgICAgICBpZiAoIW1hdGNoZWRGaWxlSGFuZGxlICYmIHRhcmdldERpckhhbmRsZSAhPT0gZmlsZXNIYW5kbGUpIHtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgZW50cnkgb2YgZmlsZXNIYW5kbGUudmFsdWVzKCkpIHtcbiAgICAgICAgICAgICAgaWYgKGVudHJ5LmtpbmQgPT09IFwiZmlsZVwiKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGlza05hbWVSYXcgPSBlbnRyeS5uYW1lLnRvTG93ZXJDYXNlKCkudHJpbSgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGRpc2tOYW1lU2FuaXRpemVkID0gc2FuaXRpemVGaWxlbmFtZShlbnRyeS5uYW1lKS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICBkaXNrTmFtZVJhdyA9PT0gcmF3VGFyZ2V0IHx8XG4gICAgICAgICAgICAgICAgICBkaXNrTmFtZVJhdyA9PT0gc2FuaXRpemVkVGFyZ2V0IHx8XG4gICAgICAgICAgICAgICAgICBkaXNrTmFtZVNhbml0aXplZCA9PT0gc2FuaXRpemVkVGFyZ2V0IHx8XG4gICAgICAgICAgICAgICAgICBkaXNrTmFtZVJhdy5yZXBsYWNlKC9cXCsvZywgXCIgXCIpID09PSByYXdUYXJnZXRcbiAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgIG1hdGNoZWRGaWxlSGFuZGxlID0gZW50cnk7XG4gICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBGYWxsYmFjayAyOiBSZWN1cnNpdmUgc2VhcmNoIHVuZGVyIGZpbGVzSGFuZGxlIGlmIHN0aWxsIG5vdCBmb3VuZFxuICAgICAgICAgIGlmICghbWF0Y2hlZEZpbGVIYW5kbGUpIHtcbiAgICAgICAgICAgIGFzeW5jIGZ1bmN0aW9uIGZpbmRSZWN1cnNpdmUoZGlyKSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgZW50cnkgb2YgZGlyLnZhbHVlcygpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVudHJ5LmtpbmQgPT09IFwiZmlsZVwiKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBkaXNrTmFtZVJhdyA9IGVudHJ5Lm5hbWUudG9Mb3dlckNhc2UoKS50cmltKCk7XG4gICAgICAgICAgICAgICAgICBjb25zdCBkaXNrTmFtZVNhbml0aXplZCA9IHNhbml0aXplRmlsZW5hbWUoZW50cnkubmFtZSkudG9Mb3dlckNhc2UoKS50cmltKCk7XG4gICAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAgIGRpc2tOYW1lUmF3ID09PSByYXdUYXJnZXQgfHxcbiAgICAgICAgICAgICAgICAgICAgZGlza05hbWVSYXcgPT09IHNhbml0aXplZFRhcmdldCB8fFxuICAgICAgICAgICAgICAgICAgICBkaXNrTmFtZVNhbml0aXplZCA9PT0gc2FuaXRpemVkVGFyZ2V0IHx8XG4gICAgICAgICAgICAgICAgICAgIGRpc2tOYW1lUmF3LnJlcGxhY2UoL1xcKy9nLCBcIiBcIikgPT09IHJhd1RhcmdldFxuICAgICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBlbnRyeTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGVudHJ5LmtpbmQgPT09IFwiZGlyZWN0b3J5XCIpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGZvdW5kID0gYXdhaXQgZmluZFJlY3Vyc2l2ZShlbnRyeSk7XG4gICAgICAgICAgICAgICAgICBpZiAoZm91bmQpIHJldHVybiBmb3VuZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBtYXRjaGVkRmlsZUhhbmRsZSA9IGF3YWl0IGZpbmRSZWN1cnNpdmUoZmlsZXNIYW5kbGUpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICghbWF0Y2hlZEZpbGVIYW5kbGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRmlsZSBcIiR7cmF3VGFyZ2V0fVwiIG5vdCBmb3VuZCBpbiBGaWxlcyBkaXJlY3RvcnkuYCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gNC4gUmV0cmlldmUgRmlsZSBPYmplY3RcbiAgICAgICAgY29uc3QgbG9hZGVkRmlsZSA9IGF3YWl0IG1hdGNoZWRGaWxlSGFuZGxlLmdldEZpbGUoKTtcbiAgICAgICAgc2V0RmlsZU9iamVjdChsb2FkZWRGaWxlKTtcblxuICAgICAgICAvLyA1LiBDcmVhdGUgT2JqZWN0IFVSTFxuICAgICAgICBvYmplY3RVcmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGxvYWRlZEZpbGUpO1xuICAgICAgICBzZXRGaWxlVXJsKG9iamVjdFVybCk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBDb3VsZCBub3QgbG9hZCBsb2NhbCBmaWxlOiBcIiR7cmF3RmlsZU5hbWV9XCJgLCBlcnIpO1xuICAgICAgICBzZXRFcnJvcihlcnIubWVzc2FnZSB8fCBcIkZpbGUgb3IgZGlyZWN0b3J5IG5vdCBmb3VuZCBsb2NhbGx5LlwiKTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHNldElzTG9hZGluZyhmYWxzZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbG9hZExvY2FsRmlsZSgpO1xuXG4gICAgLy8gQ1JJVElDQUw6IFByZXZlbnQgbWVtb3J5IGxlYWtzIGJ5IHJldm9raW5nIHRoZSBVUkwgd2hlbiB0aGUgY29tcG9uZW50IHVubW91bnRzXG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGlmIChvYmplY3RVcmwpIHtcbiAgICAgICAgVVJMLnJldm9rZU9iamVjdFVSTChvYmplY3RVcmwpO1xuICAgICAgfVxuICAgIH07XG4gIH0sIFtkaXJIYW5kbGUsIGNvdXJzZURhdGEsIHNhbml0aXplZEFzc2lnbm1lbnROYW1lLCBzYW5pdGl6ZWRGaWxlTmFtZSwgdGFyZ2V0RmlsZT8uaWQsIHRhcmdldEZpbGU/LmZvbGRlcl9pZF0pO1xuXG4gIGNvbnN0IG1pbWVDbGFzcyA9IGdldE1pbWVDbGFzcyh0YXJnZXRGaWxlKTtcbiAgY29uc3QgZm9ybWF0dGVkU2l6ZSA9IHRhcmdldEZpbGU/LnNpemUgPyAodGFyZ2V0RmlsZS5zaXplIC8gMTAyNCkudG9GaXhlZCgxKSArIFwiIEtCXCIgOiBcIi1cIjtcblxuICBpZiAoaXNMb2FkaW5nKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXZcbiAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICBwYWRkaW5nOiBcIjFyZW1cIixcbiAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiI2YzZjRmNlwiLFxuICAgICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgI2U1ZTdlYlwiLFxuICAgICAgICAgIGJvcmRlclJhZGl1czogXCIwLjI1cmVtXCIsXG4gICAgICAgICAgbWFyZ2luQm90dG9tOiBcIjFyZW1cIixcbiAgICAgICAgfX1cbiAgICAgID5cbiAgICAgICAgTG9hZGluZyB7cmF3RmlsZU5hbWV9Li4uXG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG5cbiAgaWYgKGVycm9yKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXZcbiAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICBwYWRkaW5nOiBcIjFyZW1cIixcbiAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiI2ZlZjJmMlwiLFxuICAgICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgI2ZlY2FjYVwiLFxuICAgICAgICAgIGNvbG9yOiBcIiM5OTFiMWJcIixcbiAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiMC4yNXJlbVwiLFxuICAgICAgICAgIG1hcmdpbkJvdHRvbTogXCIxcmVtXCIsXG4gICAgICAgIH19XG4gICAgICA+XG4gICAgICAgIHtlcnJvcn0gKHtzYW5pdGl6ZWRGaWxlTmFtZX0pXG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG5cbiAgbGV0IGNvbnRlbnQ7XG4gIHN3aXRjaCAobWltZUNsYXNzKSB7XG4gICAgY2FzZSBcImltYWdlXCI6XG4gICAgICBjb250ZW50ID0gKFxuICAgICAgICA8aW1nXG4gICAgICAgICAgc3JjPXtmaWxlVXJsfVxuICAgICAgICAgIGFsdD17cmF3RmlsZU5hbWV9XG4gICAgICAgICAgc3R5bGU9e3sgbWF4V2lkdGg6IFwiMTAwJVwiLCBoZWlnaHQ6IFwiYXV0b1wiLCBib3JkZXI6IFwiMXB4IHNvbGlkICNlNWU3ZWJcIiwgYm9yZGVyUmFkaXVzOiBcIjAuMjVyZW1cIiB9fVxuICAgICAgICAvPlxuICAgICAgKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSBcInZpZGVvXCI6XG4gICAgICBjb250ZW50ID0gKFxuICAgICAgICA8dmlkZW8gY29udHJvbHMgc3R5bGU9e3sgd2lkdGg6IFwiMTAwJVwiLCBtYXhXaWR0aDogXCI0MnJlbVwiLCBib3JkZXI6IFwiMXB4IHNvbGlkICNlNWU3ZWJcIiwgYm9yZGVyUmFkaXVzOiBcIjAuMjVyZW1cIiB9fT5cbiAgICAgICAgICA8c291cmNlIHNyYz17ZmlsZVVybH0gLz5cbiAgICAgICAgICBZb3VyIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCB0aGUgdmlkZW8gdGFnLlxuICAgICAgICA8L3ZpZGVvPlxuICAgICAgKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSBcInBkZlwiOlxuICAgIGNhc2UgXCJ0ZXh0XCI6XG4gICAgY2FzZSBcImh0bWxcIjpcbiAgICAgIGNvbnRlbnQgPSAoXG4gICAgICAgIDxpZnJhbWVcbiAgICAgICAgICBzcmM9e2ZpbGVVcmx9XG4gICAgICAgICAgdGl0bGU9e3Jhd0ZpbGVOYW1lfVxuICAgICAgICAgIHN0eWxlPXt7IHdpZHRoOiBcIjEwMCVcIiwgaGVpZ2h0OiBcIjI0cmVtXCIsIGJvcmRlcjogXCIxcHggc29saWQgI2U1ZTdlYlwiLCBib3JkZXJSYWRpdXM6IFwiMC4yNXJlbVwiLCBiYWNrZ3JvdW5kQ29sb3I6IFwiI2ZmZlwiIH19XG4gICAgICAgIC8+XG4gICAgICApO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlIFwiZG9jXCI6XG4gICAgICAvLyBSZW5kZXIgLmRvY3ggZGlyZWN0bHkgdG8gSFRNTCBpbiBtZW1vcnkhXG4gICAgICBjb250ZW50ID0gPERvY3hNZW1vcnlWaWV3ZXIgZmlsZU9iamVjdD17ZmlsZU9iamVjdH0gZmlsZVVybD17ZmlsZVVybH0gLz47XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwicHB0XCI6XG4gICAgICBjb250ZW50ID0gPFBwdHhNZW1vcnlWaWV3ZXIgZmlsZU9iamVjdD17ZmlsZU9iamVjdH0gZmlsZVVybD17ZmlsZVVybH0gLz47XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwieGxzXCI6XG4gICAgICBjb250ZW50ID0gKFxuICAgICAgICA8ZGl2XG4gICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgIHBhZGRpbmc6IFwiMnJlbVwiLFxuICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcIiNmOWZhZmJcIixcbiAgICAgICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgI2U1ZTdlYlwiLFxuICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiBcIjAuMjVyZW1cIixcbiAgICAgICAgICAgIHRleHRBbGlnbjogXCJjZW50ZXJcIixcbiAgICAgICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICAgICAgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIixcbiAgICAgICAgICAgIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsXG4gICAgICAgICAgfX1cbiAgICAgICAgPlxuICAgICAgICAgIDxzdmdcbiAgICAgICAgICAgIHN0eWxlPXt7IHdpZHRoOiBcIjNyZW1cIiwgaGVpZ2h0OiBcIjNyZW1cIiwgY29sb3I6IFwiIzNiODJmNlwiLCBtYXJnaW5Cb3R0b206IFwiMC43NXJlbVwiIH19XG4gICAgICAgICAgICBmaWxsPSdub25lJ1xuICAgICAgICAgICAgc3Ryb2tlPSdjdXJyZW50Q29sb3InXG4gICAgICAgICAgICB2aWV3Qm94PScwIDAgMjQgMjQnXG4gICAgICAgICAgPlxuICAgICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgICAgc3Ryb2tlTGluZWNhcD0ncm91bmQnXG4gICAgICAgICAgICAgIHN0cm9rZUxpbmVqb2luPSdyb3VuZCdcbiAgICAgICAgICAgICAgc3Ryb2tlV2lkdGg9JzInXG4gICAgICAgICAgICAgIGQ9J005IDEyaDZtLTYgNGg2bTIgNUg3YTIgMiAwIDAxLTItMlY1YTIgMiAwIDAxMi0yaDUuNTg2YTEgMSAwIDAxLjcwNy4yOTNsNS40MTQgNS40MTRhMSAxIDAgMDEuMjkzLjcwN1YxOWEyIDIgMCAwMS0yIDJ6J1xuICAgICAgICAgICAgPjwvcGF0aD5cbiAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICA8cCBzdHlsZT17eyBjb2xvcjogXCIjMzc0MTUxXCIsIGZvbnRXZWlnaHQ6IFwiNTAwXCIsIG1hcmdpbjogXCIwIDAgMC4yNXJlbSAwXCIgfX0+TG9jYWwgRG9jdW1lbnQgRmlsZTwvcD5cbiAgICAgICAgICA8cCBzdHlsZT17eyBmb250U2l6ZTogXCIwLjg3NXJlbVwiLCBjb2xvcjogXCIjNmI3MjgwXCIsIG1hcmdpbjogXCIwIDAgMXJlbSAwXCIgfX0+XG4gICAgICAgICAgICBCcm93c2VycyBjYW5ub3QgcHJldmlldyB7bWltZUNsYXNzfSBmaWxlcyBkaXJlY3RseS5cbiAgICAgICAgICA8L3A+XG4gICAgICAgICAgPGFcbiAgICAgICAgICAgIGhyZWY9e2ZpbGVVcmx9XG4gICAgICAgICAgICBkb3dubG9hZD17c2FuaXRpemVkRmlsZU5hbWV9IC8vIFByb21wdHMgYnJvd3NlciB0byBcInNhdmUgYXNcIiBzbyB1c2VyIGNhbiBvcGVuIG5hdGl2ZWx5XG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiI2RiZWFmZVwiLFxuICAgICAgICAgICAgICBjb2xvcjogXCIjMWQ0ZWQ4XCIsXG4gICAgICAgICAgICAgIHBhZGRpbmc6IFwiMC41cmVtIDFyZW1cIixcbiAgICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiBcIjAuMjVyZW1cIixcbiAgICAgICAgICAgICAgZm9udFdlaWdodDogXCI1MDBcIixcbiAgICAgICAgICAgICAgdGV4dERlY29yYXRpb246IFwibm9uZVwiLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICBFeHRyYWN0IHRvIHZpZXdcbiAgICAgICAgICA8L2E+XG4gICAgICAgIDwvZGl2PlxuICAgICAgKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIGNvbnRlbnQgPSAoXG4gICAgICAgIDxkaXZcbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgcGFkZGluZzogXCIxcmVtXCIsXG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiI2YzZjRmNlwiLFxuICAgICAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCAjZTVlN2ViXCIsXG4gICAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiMC4yNXJlbVwiLFxuICAgICAgICAgICAgdGV4dEFsaWduOiBcImNlbnRlclwiLFxuICAgICAgICAgIH19XG4gICAgICAgID5cbiAgICAgICAgICA8cCBzdHlsZT17eyBjb2xvcjogXCIjNGI1NTYzXCIsIG1hcmdpbjogMCB9fT5QcmV2aWV3IG5vdCBhdmFpbGFibGUgZm9yIHRoaXMgZmlsZSB0eXBlLjwvcD5cbiAgICAgICAgPC9kaXY+XG4gICAgICApO1xuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICBzdHlsZT17e1xuICAgICAgICBtYXJnaW5Cb3R0b206IFwiMS41cmVtXCIsXG4gICAgICAgIGJhY2tncm91bmRDb2xvcjogXCIjZmZmXCIsXG4gICAgICAgIHBhZGRpbmc6IFwiMXJlbVwiLFxuICAgICAgICBib3JkZXJSYWRpdXM6IFwiMC41cmVtXCIsXG4gICAgICAgIGJveFNoYWRvdzogXCIwIDFweCAzcHggcmdiYSgwLDAsMCwwLjEpXCIsXG4gICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgI2U1ZTdlYlwiLFxuICAgICAgfX1cbiAgICA+XG4gICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6IFwiZmxleFwiLCBqdXN0aWZ5Q29udGVudDogXCJzcGFjZS1iZXR3ZWVuXCIsIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsIG1hcmdpbkJvdHRvbTogXCIwLjc1cmVtXCIgfX0+XG4gICAgICAgIDxoNFxuICAgICAgICAgIHRpdGxlPXtyYXdGaWxlTmFtZX1cbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgZm9udFdlaWdodDogXCI2MDBcIixcbiAgICAgICAgICAgIGNvbG9yOiBcIiMxZjI5MzdcIixcbiAgICAgICAgICAgIG1hcmdpbjogMCxcbiAgICAgICAgICAgIHdoaXRlU3BhY2U6IFwibm93cmFwXCIsXG4gICAgICAgICAgICBvdmVyZmxvdzogXCJoaWRkZW5cIixcbiAgICAgICAgICAgIHRleHRPdmVyZmxvdzogXCJlbGxpcHNpc1wiLFxuICAgICAgICAgICAgbWF4V2lkdGg6IFwiNjAlXCIsXG4gICAgICAgICAgfX1cbiAgICAgICAgPlxuICAgICAgICAgIHtyYXdGaWxlTmFtZX1cbiAgICAgICAgPC9oND5cblxuICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6IFwiZmxleFwiLCBnYXA6IFwiMC43NXJlbVwiLCBhbGlnbkl0ZW1zOiBcImNlbnRlclwiIH19PlxuICAgICAgICAgIDxzcGFuIHN0eWxlPXt7IGZvbnRTaXplOiBcIjAuNzVyZW1cIiwgY29sb3I6IFwiIzZiNzI4MFwiIH19Pntmb3JtYXR0ZWRTaXplfTwvc3Bhbj5cbiAgICAgICAgICA8YVxuICAgICAgICAgICAgaHJlZj17ZmlsZVVybH1cbiAgICAgICAgICAgIGRvd25sb2FkPXtzYW5pdGl6ZWRGaWxlTmFtZX1cbiAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogXCIjMjU2M2ViXCIsXG4gICAgICAgICAgICAgIGNvbG9yOiBcIiNmZmZcIixcbiAgICAgICAgICAgICAgZm9udFNpemU6IFwiMC44NzVyZW1cIixcbiAgICAgICAgICAgICAgcGFkZGluZzogXCIwLjI1cmVtIDAuNzVyZW1cIixcbiAgICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiBcIjAuMjVyZW1cIixcbiAgICAgICAgICAgICAgdGV4dERlY29yYXRpb246IFwibm9uZVwiLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICBFeHRyYWN0XG4gICAgICAgICAgPC9hPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdlxuICAgICAgICBzdHlsZT17e1xuICAgICAgICAgIHdpZHRoOiBcIjEwMCVcIixcbiAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICBqdXN0aWZ5Q29udGVudDogXCJjZW50ZXJcIixcbiAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiI2Y5ZmFmYlwiLFxuICAgICAgICAgIGJvcmRlclJhZGl1czogXCIwLjI1cmVtXCIsXG4gICAgICAgICAgcGFkZGluZzogXCIwLjVyZW1cIixcbiAgICAgICAgICBib3hTaXppbmc6IFwiYm9yZGVyLWJveFwiLFxuICAgICAgICB9fVxuICAgICAgPlxuICAgICAgICB7Y29udGVudH1cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufSIsIi8qKlxuICogVGhpcyBmdW5jdGlvbiByZW5kZXJzIGEgUFBUWCBmaWxlIHRvIGFuIEhUTUwgcGFnZSB1c2luZyB0aGUgcHB0eHZpZXdqcyBsaWJyYXJ5LlxuICogQHBhcmFtIHsqfSBmaWxlT2JqZWN0IC0gVGhlIGZpbGUgb2JqZWN0IHRvIHJlbmRlci5cbiAqIEBwYXJhbSB7Kn0gZmlsZU5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZmlsZSB0byByZW5kZXIuXG4gKiBAcmV0dXJucyBUaGUgcHB0eCB2aWV3ZXIgY29tcG9uZW50IGZvciB0aGUgYXNzaWdubWVudC5cbiAqL1xuZnVuY3Rpb24gUHB0eE1lbW9yeVZpZXdlcih7IGZpbGVPYmplY3QsIGZpbGVOYW1lID0gXCJwcmVzZW50YXRpb24ucHB0eFwiIH0pIHtcbiAgY29uc3QgY2FudmFzUmVmID0gUmVhY3QudXNlUmVmKG51bGwpO1xuICBjb25zdCB2aWV3ZXJSZWYgPSBSZWFjdC51c2VSZWYobnVsbCk7XG5cbiAgY29uc3QgW2xvYWRpbmcsIHNldExvYWRpbmddID0gdXNlU3RhdGUodHJ1ZSk7XG4gIGNvbnN0IFtyZW5kZXJGYWlsZWQsIHNldFJlbmRlckZhaWxlZF0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFtmYWxsYmFja1VybCwgc2V0RmFsbGJhY2tVcmxdID0gdXNlU3RhdGUobnVsbCk7XG5cbiAgLy8gR2VuZXJhdGUgZmFsbGJhY2sgVVJMIGZvciBleHRyYWN0aW9uIGlmIHJlbmRlciBmYWlsc1xuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghZmlsZU9iamVjdCkgcmV0dXJuO1xuICAgIGNvbnN0IHVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoZmlsZU9iamVjdCk7XG4gICAgc2V0RmFsbGJhY2tVcmwodXJsKTtcbiAgICByZXR1cm4gKCkgPT4gVVJMLnJldm9rZU9iamVjdFVSTCh1cmwpO1xuICB9LCBbZmlsZU9iamVjdF0pO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgbGV0IGlzTW91bnRlZCA9IHRydWU7XG5cbiAgICBhc3luYyBmdW5jdGlvbiByZW5kZXJTbGlkZXMoKSB7XG4gICAgICBpZiAoIWZpbGVPYmplY3QgfHwgIWNhbnZhc1JlZi5jdXJyZW50KSByZXR1cm47XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIHNldExvYWRpbmcodHJ1ZSk7XG5cbiAgICAgICAgY29uc3QgVmlld2VyQ2xhc3MgPVxuICAgICAgICAgIHdpbmRvdy5QUFRYVmlld2VyIHx8XG4gICAgICAgICAgKHdpbmRvdy5QcHR4Vmlld0pTICYmIHdpbmRvdy5QcHR4Vmlld0pTLlBQVFhWaWV3ZXIpIHx8XG4gICAgICAgICAgKHdpbmRvdy5wcHR4dmlld2pzICYmIHdpbmRvdy5wcHR4dmlld2pzLlBQVFhWaWV3ZXIpIHx8XG4gICAgICAgICAgd2luZG93LlBwdHhWaWV3SlM7XG5cbiAgICAgICAgaWYgKCFWaWV3ZXJDbGFzcykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlBwdHhWaWV3SlMgc2NyaXB0IHRhZyBub3QgbG9hZGVkIG9yIGdsb2JhbCB1bmF2YWlsYWJsZS5cIik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB2aWV3ZXIgPSBuZXcgVmlld2VyQ2xhc3MoeyBjYW52YXM6IGNhbnZhc1JlZi5jdXJyZW50IH0pO1xuICAgICAgICB2aWV3ZXJSZWYuY3VycmVudCA9IHZpZXdlcjtcblxuICAgICAgICBjb25zdCBhcnJheUJ1ZmZlciA9IGF3YWl0IGZpbGVPYmplY3QuYXJyYXlCdWZmZXIoKTtcblxuICAgICAgICBhd2FpdCB2aWV3ZXIubG9hZEZpbGUoYXJyYXlCdWZmZXIpO1xuICAgICAgICBhd2FpdCB2aWV3ZXIucmVuZGVyKCk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS53YXJuKFwiUHB0eFZpZXdKUyByZW5kZXIgZmFpbGVkLCBzd2l0Y2hpbmcgdG8gZXh0cmFjdGlvbiBmYWxsYmFjazpcIiwgZXJyKTtcbiAgICAgICAgaWYgKGlzTW91bnRlZCkge1xuICAgICAgICAgIHNldFJlbmRlckZhaWxlZCh0cnVlKTtcbiAgICAgICAgfVxuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgaWYgKGlzTW91bnRlZCkge1xuICAgICAgICAgIHNldExvYWRpbmcoZmFsc2UpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmVuZGVyU2xpZGVzKCk7XG5cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgaXNNb3VudGVkID0gZmFsc2U7XG4gICAgfTtcbiAgfSwgW2ZpbGVPYmplY3RdKTtcblxuICBjb25zdCBoYW5kbGVOZXh0U2xpZGUgPSBhc3luYyAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGlmICh2aWV3ZXJSZWYuY3VycmVudD8ubmV4dFNsaWRlKSB7XG4gICAgICAgIGF3YWl0IHZpZXdlclJlZi5jdXJyZW50Lm5leHRTbGlkZSgpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiRW5kIG9mIHByZXNlbnRhdGlvbiByZWFjaGVkLlwiKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlUHJldlNsaWRlID0gYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBpZiAodmlld2VyUmVmLmN1cnJlbnQ/LnByZXZpb3VzU2xpZGUpIHtcbiAgICAgICAgYXdhaXQgdmlld2VyUmVmLmN1cnJlbnQucHJldmlvdXNTbGlkZSgpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiQmVnaW5uaW5nIG9mIHByZXNlbnRhdGlvbiByZWFjaGVkLlwiKTtcbiAgICB9XG4gIH07XG5cbiAgaWYgKHJlbmRlckZhaWxlZCkge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2XG4gICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgcGFkZGluZzogXCIycmVtXCIsXG4gICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcIiNmOWZhZmJcIixcbiAgICAgICAgICBib3JkZXI6IFwiMXB4IHNvbGlkICNlNWU3ZWJcIixcbiAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiMC4yNXJlbVwiLFxuICAgICAgICAgIHRleHRBbGlnbjogXCJjZW50ZXJcIixcbiAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICBmbGV4RGlyZWN0aW9uOiBcImNvbHVtblwiLFxuICAgICAgICAgIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsXG4gICAgICAgIH19XG4gICAgICA+XG4gICAgICAgIDxzdmdcbiAgICAgICAgICBzdHlsZT17eyB3aWR0aDogXCIzcmVtXCIsIGhlaWdodDogXCIzcmVtXCIsIGNvbG9yOiBcIiNmOTczMTZcIiwgbWFyZ2luQm90dG9tOiBcIjAuNzVyZW1cIiB9fVxuICAgICAgICAgIGZpbGw9J25vbmUnXG4gICAgICAgICAgc3Ryb2tlPSdjdXJyZW50Q29sb3InXG4gICAgICAgICAgdmlld0JveD0nMCAwIDI0IDI0J1xuICAgICAgICA+XG4gICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgIHN0cm9rZUxpbmVjYXA9J3JvdW5kJ1xuICAgICAgICAgICAgc3Ryb2tlTGluZWpvaW49J3JvdW5kJ1xuICAgICAgICAgICAgc3Ryb2tlV2lkdGg9JzInXG4gICAgICAgICAgICBkPSdNMTIgOXYybTAgNGguMDFtLTYuOTM4IDRoMTMuODU2YzEuNTQgMCAyLjUwMi0xLjY2NyAxLjczMi0zTDEzLjczMiA0Yy0uNzctMS4zMzMtMi42OTQtMS4zMzMtMy40NjQgMEwzLjM0IDE2Yy0uNzcgMS4zMzMuMTkyIDMgMS43MzIgM3onXG4gICAgICAgICAgPjwvcGF0aD5cbiAgICAgICAgPC9zdmc+XG4gICAgICAgIDxwIHN0eWxlPXt7IGNvbG9yOiBcIiMzNzQxNTFcIiwgZm9udFdlaWdodDogXCI1MDBcIiwgbWFyZ2luOiBcIjAgMCAwLjI1cmVtIDBcIiB9fT5Db21wbGV4IFBvd2VyUG9pbnQgRmlsZTwvcD5cbiAgICAgICAgPHAgc3R5bGU9e3sgZm9udFNpemU6IFwiMC44NzVyZW1cIiwgY29sb3I6IFwiIzZiNzI4MFwiLCBtYXJnaW46IFwiMCAwIDFyZW0gMFwiIH19PlVuYWJsZSB0byBwcmV2aWV3IHNsaWRlcyBpbmxpbmUuPC9wPlxuICAgICAgICB7ZmFsbGJhY2tVcmwgJiYgKFxuICAgICAgICAgIDxhXG4gICAgICAgICAgICBocmVmPXtmYWxsYmFja1VybH1cbiAgICAgICAgICAgIGRvd25sb2FkPXtmaWxlTmFtZX1cbiAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogXCIjZGJlYWZlXCIsXG4gICAgICAgICAgICAgIGNvbG9yOiBcIiMxZDRlZDhcIixcbiAgICAgICAgICAgICAgcGFkZGluZzogXCIwLjVyZW0gMXJlbVwiLFxuICAgICAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiMC4yNXJlbVwiLFxuICAgICAgICAgICAgICBmb250V2VpZ2h0OiBcIjUwMFwiLFxuICAgICAgICAgICAgICB0ZXh0RGVjb3JhdGlvbjogXCJub25lXCIsXG4gICAgICAgICAgICB9fVxuICAgICAgICAgID5cbiAgICAgICAgICAgIEV4dHJhY3QgdG8gdmlldyBpbiBQb3dlclBvaW50XG4gICAgICAgICAgPC9hPlxuICAgICAgICApfVxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiAoXG4gICAgPGRpdlxuICAgICAgc3R5bGU9e3tcbiAgICAgICAgd2lkdGg6IFwiMTAwJVwiLFxuICAgICAgICBtaW5IZWlnaHQ6IFwiNDUwcHhcIixcbiAgICAgICAgcGFkZGluZzogXCIxLjVyZW1cIixcbiAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcIiMyYTJkMzJcIixcbiAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCAjZTVlN2ViXCIsXG4gICAgICAgIGJvcmRlclJhZGl1czogXCIwLjM3NXJlbVwiLFxuICAgICAgICBib3hTaXppbmc6IFwiYm9yZGVyLWJveFwiLFxuICAgICAgICBwb3NpdGlvbjogXCJyZWxhdGl2ZVwiLFxuICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIixcbiAgICAgICAgYWxpZ25JdGVtczogXCJjZW50ZXJcIixcbiAgICAgICAganVzdGlmeUNvbnRlbnQ6IFwiY2VudGVyXCIsXG4gICAgICB9fVxuICAgID5cbiAgICAgIHtsb2FkaW5nICYmIChcbiAgICAgICAgPGRpdlxuICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICBwb3NpdGlvbjogXCJhYnNvbHV0ZVwiLFxuICAgICAgICAgICAgdG9wOiAwLFxuICAgICAgICAgICAgbGVmdDogMCxcbiAgICAgICAgICAgIHJpZ2h0OiAwLFxuICAgICAgICAgICAgYm90dG9tOiAwLFxuICAgICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsXG4gICAgICAgICAgICBhbGlnbkl0ZW1zOiBcImNlbnRlclwiLFxuICAgICAgICAgICAganVzdGlmeUNvbnRlbnQ6IFwiY2VudGVyXCIsXG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiIzJhMmQzMlwiLFxuICAgICAgICAgICAgY29sb3I6IFwiI2ZmZlwiLFxuICAgICAgICAgICAgekluZGV4OiAxMCxcbiAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCIwLjM3NXJlbVwiLFxuICAgICAgICAgIH19XG4gICAgICAgID5cbiAgICAgICAgICBMb2FkaW5nIFByZXNlbnRhdGlvbi4uLlxuICAgICAgICA8L2Rpdj5cbiAgICAgICl9XG5cbiAgICAgIHsvKiBcbiAgICAgICAgVGhpcyBzdHlsZSBibG9jayBmb3JjZXMgdGhlIGJyb3dzZXIgdG8gaWdub3JlIHRoZSBsaWJyYXJ5J3MgaW5saW5lIHBpeGVsIFxuICAgICAgICB3aWR0aHMgYW5kIHN0cmV0Y2ggdGhlIGNhbnZhcyB0byBmaWxsIHRoZSBtYXgtd2lkdGggY29udGFpbmVyIGJlbG93LlxuICAgICAgKi99XG4gICAgICA8c3R5bGU+XG4gICAgICAgIHtgXG4gICAgICAgICAgLmZvcmNlZC1mdWxsLXdpZHRoIHtcbiAgICAgICAgICAgIHdpZHRoOiAxMDAlICFpbXBvcnRhbnQ7XG4gICAgICAgICAgICBoZWlnaHQ6IGF1dG8gIWltcG9ydGFudDtcbiAgICAgICAgICB9XG4gICAgICAgIGB9XG4gICAgICA8L3N0eWxlPlxuXG4gICAgICA8ZGl2XG4gICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgd2lkdGg6IFwiMTAwJVwiLFxuICAgICAgICAgIG1heFdpZHRoOiBcIjk2MHB4XCIsIC8vIFRoZSBzbGlkZXMgd2lsbCBzYWZlbHkgc2NhbGUgdXAgdG8gdGhpcyB3aWR0aFxuICAgICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICAgIGp1c3RpZnlDb250ZW50OiBcImNlbnRlclwiLFxuICAgICAgICAgIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsXG4gICAgICAgICAgb3BhY2l0eTogbG9hZGluZyA/IDAgOiAxLFxuICAgICAgICAgIHRyYW5zaXRpb246IFwib3BhY2l0eSAwLjNzIGVhc2VcIixcbiAgICAgICAgfX1cbiAgICAgID5cbiAgICAgICAgPGNhbnZhc1xuICAgICAgICAgIHJlZj17Y2FudmFzUmVmfVxuICAgICAgICAgIGNsYXNzTmFtZT0nZm9yY2VkLWZ1bGwtd2lkdGgnXG4gICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgIGRpc3BsYXk6IFwiYmxvY2tcIixcbiAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogXCIjZmZmXCIsXG4gICAgICAgICAgICBib3hTaGFkb3c6IFwiMCAxMHB4IDI1cHggLTVweCByZ2JhKDAsIDAsIDAsIDAuNiksIDAgOHB4IDEwcHggLTZweCByZ2JhKDAsIDAsIDAsIDAuNClcIixcbiAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCI0cHhcIixcbiAgICAgICAgICB9fVxuICAgICAgICAvPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxkaXZcbiAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICBqdXN0aWZ5Q29udGVudDogXCJjZW50ZXJcIixcbiAgICAgICAgICBnYXA6IFwiMXJlbVwiLFxuICAgICAgICAgIG1hcmdpblRvcDogXCIxLjI1cmVtXCIsXG4gICAgICAgICAgb3BhY2l0eTogbG9hZGluZyA/IDAgOiAxLFxuICAgICAgICAgIHBvaW50ZXJFdmVudHM6IGxvYWRpbmcgPyBcIm5vbmVcIiA6IFwiYXV0b1wiLFxuICAgICAgICB9fVxuICAgICAgPlxuICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgb25DbGljaz17aGFuZGxlUHJldlNsaWRlfVxuICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICBwYWRkaW5nOiBcIjAuNXJlbSAxLjI1cmVtXCIsXG4gICAgICAgICAgICBjdXJzb3I6IFwicG9pbnRlclwiLFxuICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiBcIjRweFwiLFxuICAgICAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCAjNGI1NTYzXCIsXG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiIzM3NDE1MVwiLFxuICAgICAgICAgICAgY29sb3I6IFwid2hpdGVcIixcbiAgICAgICAgICAgIGZvbnRXZWlnaHQ6IFwiNTAwXCIsXG4gICAgICAgICAgfX1cbiAgICAgICAgPlxuICAgICAgICAgICZsYXJyOyBQcmV2aW91cyBTbGlkZVxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvblxuICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZU5leHRTbGlkZX1cbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgcGFkZGluZzogXCIwLjVyZW0gMS4yNXJlbVwiLFxuICAgICAgICAgICAgY3Vyc29yOiBcInBvaW50ZXJcIixcbiAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCI0cHhcIixcbiAgICAgICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgIzRiNTU2M1wiLFxuICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcIiMzNzQxNTFcIixcbiAgICAgICAgICAgIGNvbG9yOiBcIndoaXRlXCIsXG4gICAgICAgICAgICBmb250V2VpZ2h0OiBcIjUwMFwiLFxuICAgICAgICAgIH19XG4gICAgICAgID5cbiAgICAgICAgICBOZXh0IFNsaWRlICZyYXJyO1xuICAgICAgICA8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufVxuIiwiLyoqXG4gKiBNb2RpZmllZCBDYW52YXNMTVMgc291cmNlIGNvZGUgdG8gY3JlYXRlIGEgc2ltaWxhciBsb29raW5nIHNjb3JlIGRpc3RyaWJ1dGlvbiBncmFwaCAoYm94cGxvdClcbiAqIEBwYXJhbSB7T2JqZWN0fSBhc3NpZ25tZW50IC0gVGhlIGFzc2lnbm1lbnQgdG8gY3JlYXRlIGEgc2NvcmUgZGlzdHJpYnV0aW9uIGdyYXBoIGZvci4gTXVzdCBjb250YWluIHNjb3JlX3N0YXRpc3RpY3MuXG4gKiBAcmV0dXJucyB7SlNYLkVsZW1lbnR9IFRoZSBzY29yZSBkaXN0cmlidXRpb24gZ3JhcGguXG4gKi9cbmNvbnN0IFNjb3JlRGlzdHJpYnV0aW9uR3JhcGggPSAoeyBhc3NpZ25tZW50IH0pID0+IHtcbiAgLy8gQ29uc3RhbnRzIGJhc2VkIG9uIENhbnZhcyBMTVMgU1ZHIGNvb3JkaW5hdGUgc3lzdGVtXG4gIGNvbnN0IEdSQVBIX1NDQUxBUiA9IDE1MC4wO1xuICBjb25zdCBHUkFZX0NPTE9SID0gXCIjNEE1QjY4XCI7XG4gIGNvbnN0IEJMVUVfQ09MT1IgPSBcIiMyMjQ0ODhcIjtcbiAgY29uc3QgQkxVRV9GSUxMX0NPTE9SID0gXCIjYWFiYmRkXCI7XG5cbiAgLy8gU2FmZXR5IGZhbGxiYWNrcyBmb3Igc2NvcmUgc2NhbGluZ1xuICBjb25zdCBwb2ludHNQb3NzaWJsZSA9IGFzc2lnbm1lbnQ/LnBvaW50c19wb3NzaWJsZSB8fCAxMDtcblxuICBjb25zdCBzY2FsZVN0YXRWYWx1ZSA9IChzdGF0KSA9PiB7XG4gICAgaWYgKHN0YXQgPT09IHVuZGVmaW5lZCB8fCBzdGF0ID09PSBudWxsIHx8IGlzTmFOKHN0YXQpKSByZXR1cm4gMDtcbiAgICByZXR1cm4gKE51bWJlcihzdGF0KSAvIHBvaW50c1Bvc3NpYmxlKSAqIEdSQVBIX1NDQUxBUjtcbiAgfTtcblxuICAvLyBFeHRyYWN0IHZhbHVlcyBkaXJlY3RseSBmcm9tIHlvdXIgSlNPTiBmb3JtYXRcbiAgY29uc3QgdXNlclNjb3JlID0gYXNzaWdubWVudD8uc3VibWlzc2lvbj8uc2NvcmU7XG4gIGNvbnN0IHN0YXRzID0gYXNzaWdubWVudD8uc2NvcmVfc3RhdGlzdGljcyB8fCB7fTtcblxuICBjb25zdCBncmFwaCA9IHtcbiAgICB0aXRsZTogYFNjb3JlIERpc3RyaWJ1dGlvbiBHcmFwaCAtICR7YXNzaWdubWVudD8ubmFtZSB8fCBcIlwifWAsXG4gICAgbWF4X3BvczogR1JBUEhfU0NBTEFSLFxuICAgIGxvd19wb3M6IHNjYWxlU3RhdFZhbHVlKHN0YXRzLm1pbiksXG4gICAgbHFfcG9zOiBzY2FsZVN0YXRWYWx1ZShzdGF0cy5sb3dlcl9xKSxcbiAgICB1cV9wb3M6IHNjYWxlU3RhdFZhbHVlKHN0YXRzLnVwcGVyX3EpLFxuICAgIGhpZ2hfcG9zOiBzY2FsZVN0YXRWYWx1ZShzdGF0cy5tYXgpLFxuICAgIG1lZGlhbl9wb3M6IHNjYWxlU3RhdFZhbHVlKHN0YXRzLm1lZGlhbiksXG4gICAgc2NvcmVfcG9zOiBzY2FsZVN0YXRWYWx1ZSh1c2VyU2NvcmUpLFxuICB9O1xuXG4gIC8vIFNWRyBHZW9tZXRyeSBEaW1lbnNpb25zXG4gIGNvbnN0IHplcm9Qb3NpdGlvbiA9IFwiMFwiO1xuICBjb25zdCBtYXhTdmdIZWlnaHQgPSBcIjI3XCI7XG4gIGNvbnN0IG1pblN2Z0hlaWdodCA9IFwiM1wiO1xuICBjb25zdCBkaXNwbGF5U3ZnSGVpZ2h0ID0gXCIyNFwiO1xuICBjb25zdCBzdGFydFN2Z0hlaWdodCA9IFwiNlwiO1xuICBjb25zdCBzdHJva2VXaWR0aERlZmF1bHQgPSBcIjJcIjtcbiAgY29uc3QgbWlkU3ZnSGVpZ2h0ID0gXCIxNVwiO1xuXG4gIGNvbnN0IG15U2NvcmVCb3hIZWlnaHQgPSBcIjE0XCI7XG4gIGNvbnN0IG15U2NvcmVCb3hTdGFydFBvcyA9IFwiOFwiO1xuXG4gIGNvbnN0IHZpZXdCb3hWYWx1ZXMgPSBcIi0xIDAgMTYwIDMwXCI7XG5cbiAgY29uc3QgY3JlYXRlU3ZnTGluZSA9IChjbGFzc05hbWUsIHgxLCB5MSwgeDIsIHkyLCBzdHJva2VXaWR0aCA9IHN0cm9rZVdpZHRoRGVmYXVsdCkgPT4gKHtcbiAgICBjbGFzc05hbWUsXG4gICAgeDEsXG4gICAgeTEsXG4gICAgeDIsXG4gICAgeTIsXG4gICAgc3Ryb2tlV2lkdGgsXG4gIH0pO1xuXG4gIGNvbnN0IHN2Z0xpbmVzID0gW1xuICAgIGNyZWF0ZVN2Z0xpbmUoXCJ6ZXJvXCIsIHplcm9Qb3NpdGlvbiwgbWluU3ZnSGVpZ2h0LCB6ZXJvUG9zaXRpb24sIG1heFN2Z0hlaWdodCksXG4gICAgY3JlYXRlU3ZnTGluZShcInBvc3NpYmxlXCIsIGAke2dyYXBoLm1heF9wb3N9YCwgbWluU3ZnSGVpZ2h0LCBgJHtncmFwaC5tYXhfcG9zfWAsIG1heFN2Z0hlaWdodCksXG4gICAgY3JlYXRlU3ZnTGluZShcIm1pblwiLCBgJHtncmFwaC5sb3dfcG9zfWAsIHN0YXJ0U3ZnSGVpZ2h0LCBgJHtncmFwaC5sb3dfcG9zfWAsIGRpc3BsYXlTdmdIZWlnaHQpLFxuICAgIGNyZWF0ZVN2Z0xpbmUoXCJib3R0b21RXCIsIGAke2dyYXBoLmxvd19wb3N9YCwgbWlkU3ZnSGVpZ2h0LCBgJHtncmFwaC5scV9wb3N9YCwgbWlkU3ZnSGVpZ2h0KSxcbiAgICBjcmVhdGVTdmdMaW5lKFwidG9wUVwiLCBgJHtncmFwaC51cV9wb3N9YCwgbWlkU3ZnSGVpZ2h0LCBgJHtncmFwaC5oaWdoX3Bvc31gLCBtaWRTdmdIZWlnaHQpLFxuICAgIGNyZWF0ZVN2Z0xpbmUoXCJtYXhcIiwgYCR7Z3JhcGguaGlnaF9wb3N9YCwgc3RhcnRTdmdIZWlnaHQsIGAke2dyYXBoLmhpZ2hfcG9zfWAsIGRpc3BsYXlTdmdIZWlnaHQpLFxuICAgIGNyZWF0ZVN2Z0xpbmUoXCJtZWRpYW5cIiwgYCR7Z3JhcGgubWVkaWFuX3Bvc31gLCBtaW5TdmdIZWlnaHQsIGAke2dyYXBoLm1lZGlhbl9wb3N9YCwgbWF4U3ZnSGVpZ2h0KSxcbiAgXTtcblxuICBjb25zdCBtaWQ1MFJlY3QgPSB7XG4gICAgY2xhc3NOYW1lOiBcIm1pZDUwXCIsXG4gICAgeDogYCR7Z3JhcGgubHFfcG9zfWAsXG4gICAgeTogbWluU3ZnSGVpZ2h0LFxuICAgIHdpZHRoOiBgJHtNYXRoLm1heCgwLCBncmFwaC51cV9wb3MgLSBncmFwaC5scV9wb3MpfWAsXG4gICAgaGVpZ2h0OiBkaXNwbGF5U3ZnSGVpZ2h0LFxuICAgIHN0cm9rZVdpZHRoOiBzdHJva2VXaWR0aERlZmF1bHQsXG4gICAgcng6IG1pblN2Z0hlaWdodCxcbiAgICBmaWxsOiBcIm5vbmVcIixcbiAgfTtcblxuICBjb25zdCBteVNjb3JlUmVjdCA9IHtcbiAgICB4OiBgJHtncmFwaC5zY29yZV9wb3MgLSA3fWAsXG4gICAgeTogbXlTY29yZUJveFN0YXJ0UG9zLFxuICAgIHdpZHRoOiBteVNjb3JlQm94SGVpZ2h0LFxuICAgIGhlaWdodDogbXlTY29yZUJveEhlaWdodCxcbiAgICBzdHJva2VXaWR0aDogc3Ryb2tlV2lkdGhEZWZhdWx0LFxuICAgIHJ4OiBtaW5TdmdIZWlnaHQsXG4gICAgZmlsbDogQkxVRV9GSUxMX0NPTE9SLFxuICB9O1xuXG4gIHJldHVybiAoXG4gICAgPHN2Z1xuICAgICAgdmlld0JveD17dmlld0JveFZhbHVlc31cbiAgICAgIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZydcbiAgICAgIHN0eWxlPXt7XG4gICAgICAgIGN1cnNvcjogXCJwb2ludGVyXCIsXG4gICAgICAgIGZsb2F0OiBcInJpZ2h0XCIsXG4gICAgICAgIGhlaWdodDogXCIzMHB4XCIsXG4gICAgICAgIHdpZHRoOiBcIjE2MXB4XCIsXG4gICAgICAgIHBvc2l0aW9uOiBcInJlbGF0aXZlXCIsXG4gICAgICB9fVxuICAgICAgYXJpYS1oaWRkZW49J3RydWUnXG4gICAgICBkYXRhLXRlc3RpZD0nc2NvcmVEaXN0cmlidXRpb25HcmFwaCdcbiAgICA+XG4gICAgICA8dGl0bGU+e2dyYXBoLnRpdGxlfTwvdGl0bGU+XG5cbiAgICAgIHsvKiBCb3hwbG90IFdoaXNrZXJzICYgQm91bmRhcnkgTGluZXMgKi99XG4gICAgICB7c3ZnTGluZXMubWFwKChsaW5lSW5zdHJ1Y3Rpb25zKSA9PiAoXG4gICAgICAgIDxsaW5lIGtleT17bGluZUluc3RydWN0aW9ucy5jbGFzc05hbWV9IHsuLi5saW5lSW5zdHJ1Y3Rpb25zfSBzdHJva2U9e0dSQVlfQ09MT1J9IC8+XG4gICAgICApKX1cblxuICAgICAgey8qIE1pZGRsZSA1MCUgQm94IChJUVIpICovfVxuICAgICAgPHJlY3Qgey4uLm1pZDUwUmVjdH0gc3Ryb2tlPXtHUkFZX0NPTE9SfSAvPlxuXG4gICAgICB7LyogU3R1ZGVudCBTY29yZSBTcXVhcmUgTWFya2VyICovfVxuICAgICAge3VzZXJTY29yZSAhPT0gdW5kZWZpbmVkICYmIHVzZXJTY29yZSAhPT0gbnVsbCAmJiAoXG4gICAgICAgIDxyZWN0IGNsYXNzTmFtZT0nbXlTY29yZScgey4uLm15U2NvcmVSZWN0fSBzdHJva2U9e0JMVUVfQ09MT1J9PlxuICAgICAgICAgIDx0aXRsZT57YFlvdXIgU2NvcmU6ICR7dXNlclNjb3JlfSBvdXQgb2YgJHtwb2ludHNQb3NzaWJsZX1gfTwvdGl0bGU+XG4gICAgICAgIDwvcmVjdD5cbiAgICAgICl9XG4gICAgPC9zdmc+XG4gICk7XG59O1xuIiwiLyoqXG4gKiBUb3AgQnJlYWRjcnVtYnMgY29tcG9uZW50IHRoYXQgZGlzcGxheXMgbmF2aWdhdGlvbiBicmVhZGNydW1icyBmb3IgdGhlIGNvdXJzZS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wc1xuICogQHBhcmFtIHt7dGl0bGU6IHN0cmluZywgY2FsbGJhY2s/OiBmdW5jdGlvbn1bXX0gcHJvcHMubGlzdFxuICovXG5mdW5jdGlvbiBUb3BCcmVhZGNydW1icyh7IGxpc3QgPSBbXSB9KSB7XG4gIGNvbnN0IHsgY291cnNlRGF0YSB9ID0gdXNlQ291cnNlQ29udGV4dCgpO1xuICBjb25zdCB7IG5hdmlnYXRlVG9TZWN0aW9uIH0gPSB1c2VOYXZpZ2F0aW9uKCk7XG5cbiAgaWYgKCFjb3Vyc2VEYXRhKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBjb3Vyc2VUaXRsZSA9IGNvdXJzZURhdGE/Lm1hbmlmZXN0Py5jb3Vyc2U7XG5cbiAgcmV0dXJuIChcbiAgICA8bmF2IGFyaWEtbGFiZWw9J2JyZWFkY3J1bWInPlxuICAgICAgPG9sIGNsYXNzTmFtZT0ndG9wLWJyZWFkY3J1bWJzJz5cbiAgICAgICAge2NvdXJzZVRpdGxlICYmIChcbiAgICAgICAgICA8bGkgY2xhc3NOYW1lPSdicmVhZGNydW1iLWl0ZW0nIHN0eWxlPXt7IGN1cnNvcjogXCJwb2ludGVyXCIgfX0gb25DbGljaz17KCkgPT4gbmF2aWdhdGVUb1NlY3Rpb24oXCJmcm9udHBhZ2VcIil9PlxuICAgICAgICAgICAge2NvdXJzZVRpdGxlfVxuICAgICAgICAgIDwvbGk+XG4gICAgICAgICl9XG5cbiAgICAgICAge0FycmF5LmlzQXJyYXkobGlzdCkgJiZcbiAgICAgICAgICBsaXN0Lm1hcCgoaXRlbSwgaW5kZXgpID0+IChcbiAgICAgICAgICAgIDxsaVxuICAgICAgICAgICAgICBrZXk9e2l0ZW0uaWQgfHwgaW5kZXh9XG4gICAgICAgICAgICAgIGNsYXNzTmFtZT0nYnJlYWRjcnVtYi1pdGVtJ1xuICAgICAgICAgICAgICBvbkNsaWNrPXtpdGVtLmNhbGxiYWNrfVxuICAgICAgICAgICAgICBzdHlsZT17aXRlbS5jYWxsYmFjayA/IHsgY3Vyc29yOiBcInBvaW50ZXJcIiB9IDogdW5kZWZpbmVkfVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICB7aXRlbS50aXRsZX1cbiAgICAgICAgICAgIDwvbGk+XG4gICAgICAgICAgKSl9XG4gICAgICA8L29sPlxuICAgIDwvbmF2PlxuICApO1xufVxuIiwiLyoqXG4gKiBTaW1wbGUgY29tcG9uZW50IHRvIHJlbmRlciB0aGUgc2VsZWN0ZWQgYW5ub3VjZW1lbnQuXG4gKiBAcmV0dXJucyB7UmVhY3QuQ29tcG9uZW50fSBUaGUgQW5ub3VuY2VtZW50RGV0YWlsQ29tcG9uZW50XG4gKi9cbmZ1bmN0aW9uIEFubm91bmNlbWVudERldGFpbFBhZ2UoKSB7XG4gIGNvbnN0IHsgY291cnNlRGF0YSB9ID0gdXNlQ291cnNlQ29udGV4dCgpO1xuICBjb25zdCB7IHNlbGVjdGVkQW5ub3VuY2VtZW50SWQsIG5hdmlnYXRlVG9Bbm5vdW5jZW1lbnQgfSA9IHVzZU5hdmlnYXRpb24oKTtcblxuICBpZiAoIWNvdXJzZURhdGEpIHtcbiAgICByZXR1cm4gPGRpdj5Mb2FkaW5nLi4uPC9kaXY+O1xuICB9XG5cbiAgY29uc3QgYW5ub3VuY2VtZW50ID0gY291cnNlRGF0YS5Bbm5vdW5jZW1lbnRzLmZpbmQoKGFubm91bmNlbWVudCkgPT4gYW5ub3VuY2VtZW50LmlkID09PSBzZWxlY3RlZEFubm91bmNlbWVudElkKTtcblxuICBpZiAoIWFubm91bmNlbWVudCkge1xuICAgIHJldHVybiA8ZGl2PkFubm91bmNlbWVudCBub3QgZm91bmQuPC9kaXY+O1xuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT0ncGFnZS1kaXYnIHN0eWxlPXt7IG1hcmdpbkJvdHRvbTogXCI0ZW1cIiB9fT5cbiAgICAgIHsvKiBIZWFkZXIgKi99XG4gICAgICA8ZGl2XG4gICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgYm9yZGVyQm90dG9tOiBcIjFweCBzb2xpZCByZ2IoMzksIDUzLCA2NClcIixcbiAgICAgICAgICBwYWRkaW5nQm90dG9tOiBcIjFyZW1cIixcbiAgICAgICAgICBtYXJnaW5Cb3R0b206IFwiMXJlbVwiLFxuICAgICAgICB9fVxuICAgICAgPlxuICAgICAgICA8aDEgc3R5bGU9e3sgY29sb3I6IFwicmdiKDM5LCA1MywgNjQpXCIsIGZvbnRTaXplOiBcIjI4LjhweFwiIH19Pnthbm5vdW5jZW1lbnQudGl0bGV9PC9oMT5cbiAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiBcImZsZXhcIiwgYWxpZ25JdGVtczogXCJjZW50ZXJcIiwganVzdGlmeUNvbnRlbnQ6IFwic3BhY2UtYmV0d2VlblwiLCBnYXA6IFwiMC41cmVtXCIsIGNvbG9yOiBcIiM2MzZkNzVcIiB9fT5cbiAgICAgICAgICA8TmFtZVByb2ZpbGVDYXJkXG4gICAgICAgICAgICBuYW1lPXthbm5vdW5jZW1lbnQudXNlcl9uYW1lIHx8IGFubm91bmNlbWVudC5hdXRob3I/LmRpc3BsYXlfbmFtZSB8fCBcIkFub255bW91c1wifVxuICAgICAgICAgICAgZGF0ZT17YW5ub3VuY2VtZW50LnBvc3RlZF9hdH1cbiAgICAgICAgICAgIGluY2x1ZGVQcm9maWxlQ2lyY2xlPXt0cnVlfVxuICAgICAgICAgICAgbmFtZVN0eWxlPXt7IGZvbnRXZWlnaHQ6IFwiYm9sZFwiIH19XG4gICAgICAgICAgLz5cbiAgICAgICAgICA8c3BhblxuICAgICAgICAgICAgY2xhc3NOYW1lPSdhc3NpZ25tZW50LWxpbmsnXG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBmb250V2VpZ2h0OiBcImJvbGRcIixcbiAgICAgICAgICAgICAgY29sb3I6IFwiYmxhY2tcIixcbiAgICAgICAgICAgICAgbWFyZ2luUmlnaHQ6IFwiMmVtXCIsXG4gICAgICAgICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgcmdiKDIzMiwgMjM0LCAyMzYpXCIsXG4gICAgICAgICAgICAgIHBhZGRpbmc6IFwiMC4yNWVtXCIsXG4gICAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCI0cHhcIixcbiAgICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcInJnYigyNDIsIDI0NCwgMjQ0KVwiLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcbiAgICAgICAgICAgICAgbmF2aWdhdGVUb0Fubm91bmNlbWVudChudWxsKTtcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgPlxuICAgICAgICAgICAgQmFja1xuICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cblxuICAgICAgey8qIEJvZHkgKi99XG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzTmFtZT0nYW5ub3VuY2VtZW50LW1lc3NhZ2UnXG4gICAgICAgIHN0eWxlPXt7IGZvbnRTaXplOiBcIjE2cHhcIiwgbGluZUhlaWdodDogXCIxLjZcIiB9fVxuICAgICAgICBkYW5nZXJvdXNseVNldElubmVySFRNTD17eyBfX2h0bWw6IGFubm91bmNlbWVudC5tZXNzYWdlIH19XG4gICAgICAvPlxuICAgIDwvZGl2PlxuICApO1xufVxuIiwiLyoqXG4gKiBEaXNwbGF5cyBhbGwgb2YgdGhlIGFubm91bmNlbWVudHMgaW4gYSBjb3Vyc2UuIFRoZSBDU1MgdG8gZ2V0IHRoZSBpbmRpdmlkdWFsIGFubm91Y2VtZW50SXRlbXMgd2FzIGRpZmZpY3VsdC5cbiAqIEByZXR1cm5zIHtSZWFjdC5Db21wb25lbnR9IEFubm91bmNlbWVudHNQYWdlIGNvbXBvbmVudC5cbiAqL1xuZnVuY3Rpb24gQW5ub3VuY2VtZW50c1BhZ2UoKSB7XG4gIGNvbnN0IHsgY291cnNlRGF0YSwgcmVjb25uZWN0Rm9sZGVyIH0gPSB1c2VDb3Vyc2VDb250ZXh0KCk7XG4gIGNvbnN0IHsgbmF2aWdhdGVUb0Fubm91bmNlbWVudCB9ID0gdXNlTmF2aWdhdGlvbigpO1xuXG4gIGlmICghY291cnNlRGF0YSkge1xuICAgIHJldHVybiA8ZGl2PkxvYWRpbmcuLi48L2Rpdj47XG4gIH1cbiAgaWYgKCFjb3Vyc2VEYXRhLkFubm91bmNlbWVudHMpIHtcbiAgICByZXR1cm4gPGRpdj5ObyBhbm5vdW5jZW1lbnRzIGF2YWlsYWJsZS48L2Rpdj47XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVIVE1MKGh0bWxTdHJpbmcpIHtcbiAgICByZXR1cm4gaHRtbFN0cmluZy5yZXBsYWNlKC88W14+XSo+L2csIFwiXCIpLnJlcGxhY2UoLyZuYnNwOy9nLCBcIiBcIik7XG4gIH1cblxuICBmdW5jdGlvbiBhbm5vdW5jZW1lbnRJdGVtKGFubm91bmNlbWVudCwgaW5kZXgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdlxuICAgICAgICBrZXk9e2Fubm91bmNlbWVudC5pZH1cbiAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICBib3JkZXJCb3R0b206IFwiMXB4IHNvbGlkIHJnYigzOSwgNTMsIDY0KVwiLFxuICAgICAgICAgIGJvcmRlclRvcDogaW5kZXggPT09IDAgPyBcIjFweCBzb2xpZCByZ2IoMzksIDUzLCA2NClcIiA6IFwibm9uZVwiLFxuICAgICAgICAgIHdpZHRoOiBcIjEwMCVcIixcbiAgICAgICAgICBib3hTaXppbmc6IFwiYm9yZGVyLWJveFwiLFxuICAgICAgICAgIHBhZGRpbmc6IFwiLjc1ZW1cIixcbiAgICAgICAgICBnYXA6IFwiMWVtXCIsXG5cbiAgICAgICAgICAvLyBUSEUgRklYOiBTd2l0Y2ggZnJvbSBGbGV4Ym94IHRvIENTUyBHcmlkXG4gICAgICAgICAgZGlzcGxheTogXCJncmlkXCIsXG4gICAgICAgICAgZ3JpZFRlbXBsYXRlQ29sdW1uczogXCJhdXRvIDFmciBhdXRvXCIsXG4gICAgICAgICAgYWxpZ25JdGVtczogXCJjZW50ZXJcIixcbiAgICAgICAgfX1cbiAgICAgID5cbiAgICAgICAgey8qIExFRlQgQ09MVU1OIChhdXRvIHNpemUgYmFzZWQgb24gcHJvZmlsZSBwaWN0dXJlKSAqL31cbiAgICAgICAgPGRpdj5cbiAgICAgICAgICA8TmFtZVByb2ZpbGVDYXJkXG4gICAgICAgICAgICBuYW1lPXthbm5vdW5jZW1lbnQ/LnVzZXJfbmFtZSB8fCBhbm5vdW5jZW1lbnQ/LmF1dGhvcj8uZGlzcGxheV9uYW1lIHx8IFwiQW5vbnltb3VzXCJ9XG4gICAgICAgICAgICBkYXRlPXthbm5vdW5jZW1lbnQ/LnBvc3RlZF9hdH1cbiAgICAgICAgICAgIGluY2x1ZGVOYW1lPXtmYWxzZX1cbiAgICAgICAgICAvPlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICB7LyogTUlERExFIENPTFVNTiAoMWZyIC0gc3RyaWN0bHkgdGFrZXMgcmVtYWluaW5nIHNwYWNlKSAqL31cbiAgICAgICAgey8qIG1pbldpZHRoOiAwIGlzIHN0aWxsIHJlcXVpcmVkIGZvciB0aGUgZ3JpZCBpdGVtIHNvIHRoZSB0ZXh0IGNhbiB0cnVuY2F0ZSAqL31cbiAgICAgICAgPGRpdlxuICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICAgIGZsZXhEaXJlY3Rpb246IFwiY29sdW1uXCIsXG4gICAgICAgICAgICBtaW5XaWR0aDogMCxcbiAgICAgICAgICB9fVxuICAgICAgICA+XG4gICAgICAgICAgPGg0XG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBtYXJnaW5Cb3R0b206IFwiMFwiLFxuICAgICAgICAgICAgICBtYXJnaW5Ub3A6IFwiMFwiLFxuICAgICAgICAgICAgICB3aGl0ZVNwYWNlOiBcIm5vd3JhcFwiLFxuICAgICAgICAgICAgICBvdmVyZmxvdzogXCJoaWRkZW5cIixcbiAgICAgICAgICAgICAgdGV4dE92ZXJmbG93OiBcImVsbGlwc2lzXCIsXG4gICAgICAgICAgICAgIGNvbG9yOiBcInJnYigzOSwgNTMsIDY0KVwiLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICAgIGNsYXNzTmFtZT0nYXNzaWdubWVudC1saW5rJ1xuICAgICAgICAgICAgb25DbGljaz17KCkgPT4ge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImFubm91bmNlbWVudC5pZFwiLCBhbm5vdW5jZW1lbnQuaWQpO1xuICAgICAgICAgICAgICByZWNvbm5lY3RGb2xkZXIoKTtcbiAgICAgICAgICAgICAgbmF2aWdhdGVUb0Fubm91bmNlbWVudChhbm5vdW5jZW1lbnQuaWQpO1xuICAgICAgICAgICAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICB7YW5ub3VuY2VtZW50Py50aXRsZX1cbiAgICAgICAgICA8L2g0PlxuICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgIGNsYXNzTmFtZT0nYW5ub3VuY2VtZW50LW1lc3NhZ2UnXG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBmb250U2l6ZTogXCIxNHB4XCIsXG4gICAgICAgICAgICAgIGNvbG9yOiBcIiM2MzZkNzVcIixcbiAgICAgICAgICAgICAgd2hpdGVTcGFjZTogXCJub3dyYXBcIixcbiAgICAgICAgICAgICAgb3ZlcmZsb3c6IFwiaGlkZGVuXCIsXG4gICAgICAgICAgICAgIHRleHRPdmVyZmxvdzogXCJlbGxpcHNpc1wiLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICB7cmVtb3ZlSFRNTChhbm5vdW5jZW1lbnQ/Lm1lc3NhZ2UgfHwgXCJcIil9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIHsvKiBSSUdIVCBDT0xVTU4gKGF1dG8gc2l6ZSBiYXNlZCBvbiBhdXRob3IvZGF0ZSB0ZXh0KSAqL31cbiAgICAgICAgPGRpdj5cbiAgICAgICAgICA8TmFtZVByb2ZpbGVDYXJkXG4gICAgICAgICAgICBuYW1lPXthbm5vdW5jZW1lbnQ/LnVzZXJfbmFtZSB8fCBhbm5vdW5jZW1lbnQ/LmF1dGhvcj8uZGlzcGxheV9uYW1lIHx8IFwiQW5vbnltb3VzXCJ9XG4gICAgICAgICAgICBkYXRlPXthbm5vdW5jZW1lbnQ/LnBvc3RlZF9hdH1cbiAgICAgICAgICAgIGluY2x1ZGVQcm9maWxlQ2lyY2xlPXtmYWxzZX1cbiAgICAgICAgICAgIG5hbWVTdHlsZT17eyB0ZXh0QWxpZ246IFwicmlnaHRcIiB9fVxuICAgICAgICAgIC8+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzc05hbWU9J3BhZ2UtZGl2JyBzdHlsZT17eyBtYXJnaW5Cb3R0b206IFwiNGVtXCIgfX0+XG4gICAgICA8aDEgc3R5bGU9e3sgY29sb3I6IFwiIzY2NjY2NlwiLCBmb250U2l6ZTogMjguOCB9fT5Bbm5vdW5jZW1lbnRzPC9oMT5cbiAgICAgIDxkaXYgc3R5bGU9e3sgd2lkdGg6IFwiMTAwJVwiIH19Pntjb3Vyc2VEYXRhLkFubm91bmNlbWVudHMubWFwKChhbm5vdW5jZW1lbnQsIGluZGV4KSA9PiBhbm5vdW5jZW1lbnRJdGVtKGFubm91bmNlbWVudCwgaW5kZXgpKX08L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cbiIsIi8vIElubmVyIGNvbXBvbmVudCB0aGF0IHNhZmVseSBjb25zdW1lcyB0aGUgQ29udGV4dFxuZnVuY3Rpb24gQXBwQ29udGVudCgpIHtcbiAgY29uc3QgeyBjb3Vyc2VEYXRhLCBjbGVhckNvdXJzZURhdGEgfSA9IHVzZUNvdXJzZUNvbnRleHQoKTtcblxuICByZXR1cm4gKFxuICAgIDw+XG4gICAgICA8bmF2IGlkPSdzaWRlYmFyX25hdic+XG4gICAgICAgIDxkaXZcbiAgICAgICAgICBjbGFzc05hbWU9J3NpZGVfbmF2aWdhdGlvbl9pdGVtJ1xuICAgICAgICAgIHN0eWxlPXt7IGhlaWdodDogXCI4NXB4XCIgfX1cbiAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB3aW5kb3cub3BlbihcImh0dHBzOi8vZ2l0aHViLmNvbS9qYXNwLW5lcmQvY2FudmFzLWNvdXJzZS1kb3dubG9hZGVyXCIsIFwiX2JsYW5rXCIpfVxuICAgICAgICA+XG4gICAgICAgICAgPGltZ1xuICAgICAgICAgICAgc3JjPSdkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQURBQUFBQXdDQVlBQUFCWEF2bUhBQUFBSUdOSVVrMEFBSG9tQUFDQWhBQUErZ0FBQUlEb0FBQjFNQUFBNm1BQUFEcVlBQUFYY0p5NlVUd0FBQUFHWWt0SFJBQUFBQUFBQVBsRHUzOEFBQUFIZEVsTlJRZnFCQkFUR2gvOTE0a2NBQUFBSlhSRldIUmtZWFJsT21OeVpXRjBaUUF5TURJMkxUQTBMVEUyVkRFNU9qSTJPak14S3pBd09qQXdKQ0s5ZUFBQUFDVjBSVmgwWkdGMFpUcHRiMlJwWm5rQU1qQXlOaTB3TkMweE5sUXhPVG95Tmpvek1Tc3dNRG93TUZWL0JjUUFBQUFvZEVWWWRHUmhkR1U2ZEdsdFpYTjBZVzF3QURJd01qWXRNRFF0TVRaVU1UazZNalk2TXpFck1EQTZNREFDYWlRYkFBQVlmVWxFUVZSbzNyVjZkM1JkMVpYK3Q4KzU3VlU5VmF0TGx1UW0yeGczTURZR0RBNDlBV3p3RDBKSkl3a2hRRUpMTXFFRlRCWkpnSVRtU2VJUUowTU5MVEJ4eUM5Z0hLb05CbHl3VEN3WHlaYlZyQzY5ZnNzNWUvNlFhR2t6ckRWejFydHZ2YmZlTGQvZSs5dmYyZnVjQi93dmpQMlhmeDBIQUxURnd0aDN5bkxSUG5PRzJROElNQVBNR0FWRSsvUXA1cDdqbDRpREFIb0I3TDM0Z3YrTlI4UDR0QmZzdnU1cW1POXVBUXNKSFlrU0NZWktqWElkZ0VQbDVWTFpscExNbW9VQUV3RUFocVdoQ2FTMUljRjFWWExad1M3MTlNb3owSHJtS2NTQ0lWeVhBY0NiT1F1emY3cm0vOWFBNFBYWFFZWUVKQ2dvU3JBMEFMUjFpaVRBc0d4RlRtaWFqc1crbUo0ejY2Z01jd1V6QThBQTIvWldXTlk2TnExZHU0aG8zOGxMeWF1bzBrd0I3SUZoQW9pTjFyMmZPZ0xpZjNyaTBBdnJNZlRDK25GV0VKRVdndUU0aGJDdDBrQUluWm83aDFWcDZWZXQxdFpXTTVuOG5wSExueWp6N2d6RDlXWVlybmVjbVVwZjdYVDJ0T2p5U2RmMEhIRUVCeUhTYkZyRk9ocUpRd2pXdGszQnBGSzhET0NMQU42Lzlpcm9qZ1AvTFM3NlZ6OGVXcnNHbWZWL0JFMnVCNVFDZHJaSW1VcUxwaDB0L3RzWFg1Z28zZFh5THNCVnFlTFNXWFoxZWNyZStsNmY4RHhBQ0ErQS9PRCtEREFZbXBoTmJScndtcVkwNW1waWZiRTMzdXVBRkIwYjN0bXg4REpBTXhFZG5ERk41aXJMTlkyTmFTT1RSVzdSMFRqaU53OS8rZ2pzdS9wS2VEZmRBdEhXQm1yWkphdlhyQ1VtVWpLWDkvY2VNeDkyVDJjbCtYNmp6T2FkOE5qdzFibW1hUjdBSDdqa0U0NlorTUlNQmtrQmNjU3NZYWVsNDdPRzZ4V1RyeUpuRSttSmZHRVFBajhTMXFaU1J1SHV2V2haOXhCMnIxcng2UXpZODQxTFVmcXorMkVPRGtJNmpxRXRVMlVCWnRzK0tZakhiaE9nNnc2OXRINi9Nc3dYaVFpVTk1Y2NjZHNQUi8yQzJMZVVZUUtBQ1dZSlpqRnhTQ0pZYkZud1k3SEwrWVdYUmdtQ0F0dUdYMU94WXV5azQ4OXFtenU3dmUzSTJUdUNhUFRIT3VSTVlpbURURTJsMFFVZ3ZYZ1JXaTg2LzM5R29iMDMvUnVNMisrQXdZQS9yY25RUlluQUt5dHJkcnA2MWdyWFhVSktBd1FFMGVoLzdOL3l3dGVuemwzV3BVRzdySFJ5bVpjb2dGY3lhYW81TlBobG9kU3hRcWtDSW1KRk5LUk00eld1TFA4UDJkUFRMak01cUwrMlFWM3pyZGpVdSs5T3RSODVhOWpNdVlWTUFpQkFHVWJXTDBwOHlld2ZlTkxvNjVjMXc2TXFDYURyK205ajVwMzNmQUx2MzZ2UTVrM1FqWFh3STFGRGgwSUJpa3RPQ3g4ODlMekl1d1FpQmFJQVN0dkM5K2ZQbHlYdVErKytQR241ejlZMG9iUHZDaWJteElZdGE3SnpHNzVudnI4Ylc1OWVGMlVDTDdqb214bE1yb01hSGtKUU1XbWU3dTc3dHA0N2F5ajhoZm5YYlI3OWZMVDg3UjJLaVFDQ0FxQ2w3NGZGMFBBVGZtbEpJUXZ4eTQ3aVlrTU1EZ1pXeTY1L0hZSDNmL29qaU5kZWd4d2FsdG95bFE2RkZvVTZ1OStVYmdBVzVJUFpCT0NEMlF5aTBVY29uYjQ0bU5iVWJIUjAvbG02WGcwTFFqNGF2U0xVMmJYR3JTaC94UExjYzhDQWIxcFBPbU5EWHhxZDNEQWpNakMwVTNxQndRVDQ0ZEJ6a2U2dWMzSlYxZXVOVFBaTUVQa0FUQUFLekZJYkVtNVo2VExoKzYrUVVoSzF0V3JLNzU3KzV6a3cvTVRUZ08zUTBKY3ZWbDEvZXNhMHV3OC9KdkllV0ZBd0FaN0JiR2dwNFVkQzk0WUgraUVQZFQ4aWMyNE5NZWZBQURFZGtsS0NDQzZEd0VSRVVoTFpGZ3hCRWRKc2dCbENhMGpYUGJ2amM2Zkd2VVRCemRvd0FHWURnQVlnUVJUSVFNRWFHZjMzS2ErL2llYzJiVkVCMGQ5Ui9oTUdpSGdNNXI0MldYci9XdFF1Ty9OU3cvVW1Rd2gvNHNZTVpwK0p5QStINzZCVSt0M1NvVkZBcTBJSVFCbEd5SXRFZmhCcGIxOWYxZGxOWW5Ea0t6dFBQYmxzOTJjK1V5WjYrNzlZdGJ1ZG5QM3Q3M3FGaWJPRGtMMUxXUmJZdGpkT1dmdElVbzRsdDN2eDJQY2dKZEg0ektjQUdFeWtoT2ZQMkhmY2twUFBYbkkwaklNZDRoOGEwUHJkcS9IKzRnVW8zZklHUXNra0NnNTFnVExaVTZBMVFPQUoyaEFMc29KbzVNSFF0dTNmMTlIb3FqM0hIYnZRcjVwMHNwK0kzK3hXVnN3M2g0WnVyUm9jd3V1MzNnZ3RoTFJTbVl5VnlhYTFJUGxEWmphN3U0bnkrZjlzMk5FeTI1dmQzREJwNjQ3bFE4Y3ZPa2xId2wreS83cjd4MTQ4OW4wbGhaeFFNQVhBSTYwZ2NybG1ZeXdGOGp5eGMvWk10TXllaVgzZnV2SWpBNHh0MnlCdEUycitBcXJjZnlCSVZWV0FURE1OSWtDenhSTVRrQitMM1dxMy9QV3IrWVh6N25FR0I1OHcwK252V0FlNzk1SG5yWWJ2YnhPdUsxKzc4MDdVOWVUNDNaT1BVczhmNGVEUkdUNTJucjVFdlVRRXk5Tk1taVVBWkpjY2MyQmc2aFJRS3Y5dFozQm9YVEJ0eXYxTzE2RTczS0xDc3dQYmJtY2hKRE9IMkRTaGJXZHp2cVFRKzA4NjFaZENrQUdDZm1rRGdQSFpFbGMyVFFhRENRQWZXbjVjM0xYc1JQN1lVNTYxdXRvYVdjaGNZTnZQK1RWVkYyQms5Tmw4VmVVcUo1bTZpd3dqbzZvcUw5VFJ5SURJNTIxSXlRMjdkdXR0QjEvRnJocUpiRVd0TEJ2empLb3hKVG1lRUR2NEhkMWVBaHhWME1pOVI4MkhzMjJIb2FJaHpZbkM3VEtWdWtUazNhWDV5dklXQk9xNUtlOXV2Njl2YXNNN2dXRytweE9GMTloYjN0bWVuVnpkYlByYXM0YUg4MFFnRVBCQTM4QzRqSElrVFBsWjB6bW9LSGVLMXoyNkdYbHZwaDRhdXNMczZqbmY3RDRNcjdvSzZYaXNrZXRyU2tYL1NFY1FpVHlyeXlmZElQdjdkM00rTHptYmRUTW5uSUNXK25xYzgvQmo1TzU3bGJ2bWpUNGpYWGNoQ0FoTTQ5Mkx0dU1zQWRET2N4THNTWWxFUjJjQXg1R3djNjNwU2VVTHc4bXhHMGhhdTdPRjRkS1d6eXlUb2VUWW4zUVEvTWx0cUNpWHlXbXZ4L3NHajQzMWp4N0sxTmZQMTc0L2FPUnpCSUFGQUxCaStNS0N5aXZXZ2JhazFwQ2o2UWZjYWROT1UzTm13Uzh2ZXp6U1A3QS92UDlBbDNhTUpGTEpGYVI1TitmemtqSVpSWjZIeWtXTElYbGNKR3dBaHVZR3FYVGwrTUgxSDJTZlVCcjFxeTRFcVFDVXp5bnlQUW10OTNJMjg0VTh0Rjl3b0xNajN0ZC9FTEhvSXIra2JFcDBhMHV2bGNrZUs3d0FSRnlrTFNhMkNVeDYvSDV0RjE4SWpzYzV2dU05RVd0dGNmZjlmbTJ6VzFKOGpoZU9YQkdjOVptTmJqUitucG5KbmkrVXlzdEFXVlk2ZTR4S0ZBQ0RBeGJ5ZWNWK0FEN2pERXc2ZHhXc29rSmdRZ2RaU3A4QjhEaHU5Nk9aUjZEMG5CVlF5MCtFMWd5ZHl5dDdkTVRTMG9DVHlaNGhBeFdTZm1DYi9VTlBHZHBmd0lyM0JLSFFkbFVRKzdWYlhMckEyZHM1NEhRY0ZubzB4UjNYZmd0RytPRkhzWVVaSnhMeFVHMHRHdHY3WnVwWXZOWG8zdmVjZk9iL0F3UkpSQ0N0SFcwWUNFcUtYeVUvQUhsZWdOTk9RK2t4aTVFNDlmUVB3ZUhqU0VFZldQQ1Jmazk4bXZhcjMyTGd1V2VRN3VoQThQVHZBMjBZZ0dHOHpEa1hVQ292QWxWdHBySVY0WTVEMCtQSkZKSWxoYkNsZ2N5c0dkQ0R3N0E5RCs3THI4RHdBY3laWENlSHBqWXFYVloyclhXNDl5NG1oaTRydmx2MWRsejN6TjZOVDU0M2Y5V2xodWVkcENMaEc4S3RlOXNvVURMYmNVak5lT1gxVDJxeVpRTEFlQXREUkFRYWx3WWExMklDUU9JakkwdlBYZ2tBMk1pc215ckxKVnZXenFDczdDN0taSzRqWmpDNE9OTThEYm5pZ3ZuY00vQWdBQ1djMEZjUWpiekh2aTNac3BUaExUdGVhTU5RWkZtenpFTWRkd21sd013YXFmUzF1bUhxc3l0UC9NcW0xSkxGWjRZTzdLdUt2N3FsN1EvSkpLYTl1VkZWTGw0T0FOaDl3WGxnclFFaTZHeVdBTENhQU1zZkVHaUNTZ1JBQ0VuN0xyeUFtUm5Da0doNjZGRmtBQ1JYbktNMlAvQnpuRVYwZmZxWW93NEtwUmFKaHNvN2grY2Q2eFEvOXZDZlROY3RZd1pVZDg4THVhWEhUdUhrV01vODNFK0c3TzJWQnFCVlBIYUpVQm9nOGtFRW9iWEE0UENGUmk2LzZjOS8rWGYzMHZLQ3RybkpKSjc1eGxmSlpzMTgvcm5ZS3dWcUgzMFNOb0RPSTJZSU01T2pQa0RIOFRIa0grTlBXZ2lLYjNtTGduQ1k2L2EwNnd5QVBTcy9DejV2SmJRVU9PcjZhMmd4TTc4eXVYWU5EWSt1OFV3RGlZNm5ycEtlWHdZaFhBSkJldjRrKzkydFh4YTUzTDBna3NKcDNhdXN0djB3ZkgvaHVOY2dNTEdpSUpXZWIzUjA0THdGODM0elZ0djAxQnNWazFEKzJCTmtaVEtRNFJCcUhuMFNHUUE5VGZXU0RhazVuVmIzTVhQb1k2Z0pBSUVnQU1TVTBnaDhwUTJwdStxcVpBNUF3elBySVcwRFRuRVJFbzg5VGhzbjF5SW9LL3VsTjZYeEY4Yitka2pYUDQyWUFaQUJ3Q0FBd25WUE1qcTdZUnc0eUtLQ1dWZjRHc3dvbTNnZ0VZRklFRUNJdmYrTE5WSER6WjhqYy9uUGRaOThja0gvU1NkcTd1Mm41THFITVFRZzFWZ3Z2WGhjK1pISXlteHR6ZVBYRjhkeGFEd1RQaVE3RThSb0xJTER0a1MrdXZZeG5TaGM1UmNWcWV6VVJqa01JUEhvazhqdGI2ZkR5NWZyQStldENsTTJkN0YwM1FzM0grNjFpWFU1eG1zNCtzQXRncm0yZW1nWTFhTkpKZmlqQWsrTk4zM2o4V2ZOSUlZL3RtcUZ6eC9RT0JaVnNHMlFFSEFBZUxObnlxQ2dRS2xFd1NubWFPcHBLNU05ZjZodTh1K2lBSWpoMDBRQ0U3TnZwakxJekpyOU95dVR2Y0FZU3oyaG9wRlRWQ1Npc3JPYnBWOVdEb0FoY2xtWUkwTUdBU1JJVVBGdjFsblFiSHlVUlIrUzBnS0FjNWhCSGRHd2hHRXFibXhZTDNQWk14bWt4czlucVJ6bno3SzM1N1NncW5vdEVRblpQM0FwZkUrNHB5elg2T3dSUVRpa1lacVR3MjN0N2NMendFUjVabmI4V093UlErbG1tYzNNQTREQXNkOVJockhieW1RdUFTZ1ByUjIyVEhnTkRZM2srKzBpbHhPcXVsYUgxajhuT0JUU3Fxcm1LV2J0V3kwdG4xY3paNzFOdWR4Q0NGTGpzc3lTYmZ0MWUvdDd4eEVnNk1EY09RYUFRRHZPNVdaeWJBM3grS1REZ08wWEZGeEZRdHh2dExSQVJLTVl1bU0xN0ZkZkl6azh3aFF3NG45OG5nQndkdEZSTjhwMGFqVXJyVUdrQVJnVG5wK2dFQUhNSUNBQVF6QkI2RmpzWnJubG5kVUNJTy9NMDlrckxJU3lUTXI4djFWYzliV3ZvZUpnRnpxYlowQkZ3ZzhZbWN3M0FmZ1QybVlHa2NqZE1wMitqZ0ZUdUpNbXFaRjU4ekM4ZVBGdnRXbjFndGtHczYwdHE4ODdhdEZ2Sm05NkU2cTUrYjZncnU0bmN5NjVGTHEwaE9FNHhPRVF4aTY0QUdYTWtIMzl0K3ZDb2xzZ2hDQm1Jb0thU0x6eDF6aDRCUWF4Z0ZEeCtFMXljR0QxSzh6SXIxd0JLb2dEcFNWRXRUVTgrZVRUa1oweVpVbmJlYXVLM2JJU0JJbkNoN1NRZ0dZRHJFMldFcXF3OExkZWVRVlVhYW1pM2NjdWdlbDdFbElxeEdLejVjREFPZ0FXbHhaOXdRUHRZT1o1NGQ3RFcwa3BxRmpzbDdLdi96THlQSmw2OG5GbHJYc0lpRVlwZk4vOUlxaXJWbHhkYzZNWUcxMDlYc3VUR0U4RkhuOWphQllrVlVIOEpqa3djTHZWMHkzSFZwMnZwZXV5ODQzTG9GYWVLOWx4bEs2cHZrZU9KYi9GanIyMTQ0clBMNjc5OFM4OW5TaitrWkZPZnhjQWREVDZYVGswK0JQNHZvd2NPS1JvejRKNU1MSTVhTXNVbkVqb1dHc3I0TGtJd1VmQmNCWXYvL29odS9IZW4zUUp6eXZSbHNYNXh2cnA1UHQ3aGVjTG82QlE2K0lTc0cxVDZONzdoR3FvVjdxaThrWXhPcm9hckJVVENUQ0R4dGRLcFM0b3VCa0hENjQyZXc3TDlGZS9vam1WWWpPVkJydDVvUTFUd3pKbld3Y083SlMrNzJzcFRiKzRlQ1ZyOVh2elVCZnk4eGRNRVdOaklXdnZucDExWGQzWWRLZ1RjMnRySUs4K2R3V0Vxd0RXQk1XY216eTVIbUg3RGpkZWVNdElTZWt0OGZiV1RnUTZKWDMvS0dhbVFPbVh0UnUweXJ4bll0ZjdDbDFkb09wcStFdVd3UHp6aTVKTithb3VMVkhDODA0aVpnMW1EU0VNTGl6NmdlanJ1MDEwZE1yYzVaZHB1QzRiYlcyZ1hBN3MrU2FuVW9wYzl5d3psL3NzTVVzdEpCQkwzS2VrTGhLR2VhT1JTeGZvYWMxdnFPSm9mcXkyUm9SZjJjalpPWE1nR3U5YkEyMFFxYVltemMwekNwMis3cTF5TEhXWnpPVVhHc1JWbFBQYzBZdFdmaWNJT1MzYWRyYjd4eXg1d1JrYWhJaEVQVkZjS0lXYmhYemxKVkEyeC9rcnZxbGwrMEVwZW5wdTF3V0ptMEVrSWNqUWhZVS80SVB0dDlMK2RobGNkYVdXdnMvRy9uMmc4V1ZJUVRObmVvWlc4Qk94RjVWbGRpdkxTbklzZnBzNDJMWlpadklYR3ZuY0ZjWm84Z0ZyNjl1NzlaeTVFWC91a1ZvR2lob2ZmMks4cFdSZlFTV3pDSkpaRUdNSXRvbkFjZDd4eXNvV1VEYjdiT3dQTDJUcnQ3MTNCRzNmTVUrOHVYbWFqc2Vmb21oMGpvaEdGUktGRXJrY3hPZ0lLSmRuOTRwdmFubWdRMUozNTJwZFVQQWpMaXk2a3pvN2J4VmR2VkpmZVlVVzJSeUwwVkZ3b0FETEZtUlptajEzRWptaHUrMjBXL2p1OXAxMW1hVkxxNUJOM3hLVWxzRFoyL29kSFlzK29LVUFEQnJSbVJ4ek1nMVc2cU15cFgzeFltaUFXQWhPTHBnWENlOXJyWTI5OXRidW9XdXVkc0liWGp5UERObm5IcjNnRGV2MVRWa1c4bXg3ZFBSWkdJYkhqWk1Yd2MxdFY4TmpGa3RUOGR3NVNyZytkS0tJU3UvOENUSWxDZGErRDJzc1E3bnZmeDlpZElScDdZUEluM0VxaVh4ZWNEU3FSQ1JTSlhidTNFU2VWNmVLaXE1ZzMxK1RuelU3N3V6ZGV5NTdialVWeEo4d2VydjJaR3JxcDNGOWJhKzFmMStTQUJJZ2Juang1UWtEamw0RUxjYVh6Vk5Iem1HbnB3dCthVmswdm5YYmRwblBOMEVJc0NGN2dsRGtGblAvM2dmVjVJYTdSQ1o5clhMQ3oxTXFlYVpYVkFSaG1FaThzVW1NblAxWkp0TmltamFkekVjZUVsb3A2RXUrcEgwaCtJWGJic05aczJmSndaVXJsUkdMSWJGMkxWUTgvb2lSVFYvSW9mQ3oxdGJ0SzdKTEZuL1pTQ1h2RWtvVlFtdG95eDdOVDU4K25iT1pQbDFiRG52UFBpS0FpUVFhTnJ3eVRpSC9tS09oNWJoNHg5c1BHTGFuRWVrZmJKYSszMFNzZmRKS0NkZXJOSkpqdndycTYzOWh2YjMxdW54QllrWGdPTGVuNTh3cEpLS3ZzR1VlRXhoQ1F3aldVcER4NElQVWMvcnBxbi9wOGNxODl6NUt4Y0s0aWdnc1NLbmlJaWU4ZVZPOW1SeUJsdUpobFVoY0ZkcTZmVVh1cUlXcnpkR1JYd3ZmSzRUV1BzQ3UwQ3BoNUhPTmxsS3cyenNONVFlc2xFYlFQUHR2T3FXSjBYYlc1eWhmV2NVSWhlTFJqUnZhaE8rVmdNVDRaaGV6WWlJekNJVi9xcFc2MWpqY0I2NnUyaUF6bWVVc0JIUW85SFI2NWRrWHFlSmlON0g2RHJSZC92V1ExWDFZMWozeFpMcW12eDg5RmFYSU5UUit3MGhuYmlTdEszVW9kQ2VuVTkrQlpVUGI5bFZtT24ydllCMkFoQUF6QVV6YXRJYXlTNDV2UWo0L2FnMzBVZVA2OWYrd1ZQOXdaSTQ3SHNNamd3WUxFUVNoMEsxbU1ubnpSRTlyZzRpaE5Xc3BoVjlVZEx6ZDNmMmFTaVEyR05uc2NvQnppa1RJTFNuK25EVXl0SjdEMGZ0Rkx2ZEYxaXpZY1o0MWgvb3Z5dFEzem5MNkIxcWtDcUNKb0tLeCs5bnpyOG9YRjA4UEQvUy9Md05QZ0lUR2VFbnZnZGtLSXJHZkdabjBOZERhS0VjUW1IdmFQOWtGL3EwQlRFQ3F2bDd0K001M01mbXR0MjlSdHYwV3dEWUFsNWtCSWsxS1FXWnpseXNpQkk1elMyQlpXV1VZSWUwNEc0SncvRFdqcFJXc3RBWE5rZ0JpclkzRWdTNndIZXBuMjJ4VHBna2RqOTlwN2R4K0ZVUERUcWUrS0FKZk1NaG5RRERnZ2JXbExQdkEyS2xuM0RBNmJ5Rnl0WFVxc0syL2hmdjNFZGgxNFFVd2hvWWg4M2tSeEdJNk4yTkdwR2pEaXk4STExMEMxZ0FKajFoYktocmRIbnRuMjd5Ukk0OUEzN0psOGNLZE82Zk0yUGp5MW4xbm5nNmpydzlHVHpjMnZ2MjZVLzJIUDlxenI3eHV6RzFxaEY5VWhGeDVTUm16Y0p6QmtSbndQSFlPSG54UjExUzlKdExwcFNSRkhzd0dNd3h0V29OdVE4TWlNVExhSmx4WGF0TlVmblUxbWg5Ly9GOGJBQUQ3ajFzSytENWdTT21YbEtqcHovNG4yaGNkZmF1UnkxNUpTaFh5ZUUxeXZkWFJmVmV1cXV6bmtNYkxTb2duUmNpQ2FwcFdaTzVzdVlqYy9DbUNkVGtZTmd1Ull5bDNxR2owQ1VxUHZSUTYxQTIzdktKRFF0Zm1tcHVuMkFjUFhTSlR5WnVJR1N3RnRHRnR6TmJWWFdRTkRoNFdtYXdCM3c4NEZFTER3dytEcGsvLzF4UUNBRHJ4aFBGU1dDa2x4OGJFQTBrZklqbDJTM3J4MGdhM3BPUjB2Nno4T0hGby8xMjVxa2wzVzluY1pkTHp2eEE1M0FlaDlPbWh0OTQ2WUNiSDdqWHkrZE9sNjgwVG5qZFQ1bklMekV6bVVtdGdjSU1ReGoyVi9ZTWdTWDNDOTJHMzdubDQ4cHR2M2F5aTBldFZKUEpqcjdENHhNajJIY3RGTm51WVhGZFNQaGVRNXdFbm52QjM0UDlwQkFCZ3p3My9CbnBqRTNRc0JtWFpGTm45dnN3ZGMyeGc3bjRmZ2VQQU5VVkRvdWR3bXdnQ3FIajAvdWUzYkwzNmpDTm5wNlhyT1V6a0VkR0h1NVFnak5lanpOQkNHdW5HcGxuaG5zNHZHWm5zdGRxUVNKYVdOSWZTNmQzT2FBcHVTUW1LTjc4cEJvNWZDcEhKYXNybm9aZWRnS2I3Ly9FRytEL2RwWnoyd3pzdzlkWFhnRW5saUcvWnpNYndZR0QxSHladFNHUGxYMTVHcHJ5eUg1YTVVOXVXNTl1aFh5eS9ZRlVoYWUyQUNCQWY5YWtmVzUxak1Cc1FnTXhuWExlczZsNXRXMGtJdVM5Yld0SGQrUFkyQ2h6YkJMUHMvZXFsT3BneFErdlNFbGhmKy9vL0JmOHZJL0RQeHZ1TGo0WXBCVUVJRGlaUGlSaktkY3lPZzBPeXR4K3FwUGpiSXAzK0dTa0ZtdWhuK0dPcXJRMEpIWXRmanI2K24rdTZCbmlWWlFrWkFHamZQd3FseUZNQk42OWJOKzdaMGxKUVRkMS9pK2RULzlWZ3ZNTUNRek9KWEM1RHBESUl0S2paMThaZGhubFB2ckxxTDNKMDVCS3AvSVhRWEFaQU1WR3Z0c3d0WGtuWmI1M09qdjFXMndIS1ZWWVQrZjRvZVJyamt4YVloSUNjdCtCVHdmblVCdkRNSTJDMDdnWUlMSVlIQ1lLZ3lrbzFNYU56YXBPRTcrMlVtY3gxenI2OUtGUGo3dStOUmVIVlZBTUZQaWhRc2dKUWJRVnhOb2VHaVVBUVJBd1E2Tmlsd0xZZC83Y0d6RnI3cTAvWUF3QjdWNXdObHdoNVFIbGxreVFBSVJTclpjejZGUUM5SVVjQ0VOTDNGQi91VlowQzBMRVlwdjd4K1UrVUJkaTY5ZFBDd1g4QkdEZXBvYlFiRkRRQUFBQUFTVVZPUks1Q1lJST0nXG4gICAgICAgICAgICBhbHQ9JydcbiAgICAgICAgICAgIHdpZHRoPSc0OCdcbiAgICAgICAgICAgIGhlaWdodD0nNDgnXG4gICAgICAgICAgLz5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPSdzaWRlX25hdmlnYXRpb25faXRlbScgb25DbGljaz17KCkgPT4gYWxlcnQoXCJUaGlzIG1pZ2h0IGRvIHNvbXRoaW5nIG9uZSBkYXkuLi5cIil9PlxuICAgICAgICAgIDxzdmdcbiAgICAgICAgICAgIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZydcbiAgICAgICAgICAgIGNsYXNzTmFtZT0naWMtbmF2J1xuICAgICAgICAgICAgdmVyc2lvbj0nMS4xJ1xuICAgICAgICAgICAgeD0nMCdcbiAgICAgICAgICAgIHk9JzAnXG4gICAgICAgICAgICB2aWV3Qm94PScwIDAgMjgwIDIwMCdcbiAgICAgICAgICAgIGVuYWJsZUJhY2tncm91bmQ9J25ldyAwIDAgMjgwIDIwMCdcbiAgICAgICAgICA+XG4gICAgICAgICAgICA8cGF0aCBkPSdNMjczLjA5LDE4MC43NUgxOTcuNDdWMTY0LjQ3aDYyLjYyQTEyMi4xNiwxMjIuMTYsMCwxLDAsMTcuODUsMTQyYTEyNCwxMjQsMCwwLDAsMiwyMi41MUg5MC4xOHYxNi4yOUg2Ljg5bC0xLjUtNi4yMkExMzguNTEsMTM4LjUxLDAsMCwxLDEuNTcsMTQyQzEuNTcsNjUuNjQsNjMuNjcsMy41MywxNDAsMy41M1MyNzguNDMsNjUuNjQsMjc4LjQzLDE0MmExMzcuNjcsMTM3LjY3LDAsMCwxLTMuODQsMzIuNTdaTTY2LjQ5LDg3LjYzLDUwLjI0LDcxLjM4LDYxLjc1LDU5Ljg2LDc4LDc2LjEyWm0xNDcsMEwyMDIsNzYuMTJsMTYuMjUtMTYuMjUsMTEuNTEsMTEuNTFaTTEzMS44NSw1My44MnYtMjNoMTYuMjl2MjNabTE1LjYzLDE0Mi4zYTMxLjcxLDMxLjcxLDAsMCwxLTI4LTE2LjgxYy02LjQtMTIuMDgtMTUuNzMtNzIuMjktMTcuNTQtODQuMjVhOC4xNSw4LjE1LDAsMCwxLDEzLjU4LTcuMmM4Ljg4LDguMjEsNTMuNDgsNDkuNzIsNTkuODgsNjEuODFhMzEuNjEsMzEuNjEsMCwwLDEtMjcuOSw0Ni40NVpNMTIxLjgxLDExNi4yYzQuMTcsMjQuNTYsOS4yMyw1MC4yMSwxMiw1NS40OUExNS4zNSwxNS4zNSwwLDEsMCwxNjEsMTU3LjNDMTU4LjE4LDE1MiwxMzkuNzksMTMzLjQ0LDEyMS44MSwxMTYuMlonPjwvcGF0aD5cbiAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICBEYXNoYm9hcmRcbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPSdzaWRlX25hdmlnYXRpb25faXRlbScgb25DbGljaz17KCkgPT4gYWxlcnQoXCJUaGlzIG1pZ2h0IGRvIHNvbXRoaW5nIG9uZSBkYXkuLi5cIil9PlxuICAgICAgICAgIDxzdmdcbiAgICAgICAgICAgIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZydcbiAgICAgICAgICAgIGNsYXNzTmFtZT0naWMtbmF2J1xuICAgICAgICAgICAgdmVyc2lvbj0nMS4xJ1xuICAgICAgICAgICAgeD0nMCdcbiAgICAgICAgICAgIHk9JzAnXG4gICAgICAgICAgICB2aWV3Qm94PScwIDAgMjgwIDIwMCdcbiAgICAgICAgICAgIGVuYWJsZUJhY2tncm91bmQ9J25ldyAwIDAgMjgwIDIwMCdcbiAgICAgICAgICA+XG4gICAgICAgICAgICA8cGF0aCBkPSdNNzMuMzEsMTk4Yy0xMS45MywwLTIyLjIyLDgtMjQsMTguNzNhMjYuNjcsMjYuNjcsMCwwLDAtLjMsMy42M3YuM2EyMiwyMiwwLDAsMCw1LjQ0LDE0LjY1LDIyLjQ3LDIyLjQ3LDAsMCwwLDE3LjIyLDhIMjAwVjIyOC4xOWgtMTM0VjIxMy4wOEgyMDBWMTk4Wm0yMS0xMDUuNzRoOTAuNjRWNjJIOTQuM1pNNzkuMTksMTA3LjM0VjQ2LjkySDIwMHY2MC40MlptNy41NSwzMC4yMVYxMjIuNDVIMTkyLjQ5djE1LjExWk03MS42NSwxNi43MUEyMi43MiwyMi43MiwwLDAsMCw0OSwzOS4zNlYxOTAuODhhNDEuMTIsNDEuMTIsMCwwLDEsMjQuMzItOGgxNTdWMTYuNzFaTTMzLjg4LDM5LjM2QTM3Ljc4LDM3Ljc4LDAsMCwxLDcxLjY1LDEuNkgyNDUuMzZWMTk4SDIxNS4xNXY0NS4zMmgyMi42NlYyNTguNEg3MS42NWEzNy44NSwzNy44NSwwLDAsMS0zNy43Ni0zNy43NlonPjwvcGF0aD5cbiAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICBDb3Vyc2VzXG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT0nc2lkZV9uYXZpZ2F0aW9uX2l0ZW0nIGlkPSdDVl9TRVRUSU5HU19MSU5LJz5cbiAgICAgICAgICA8c3ZnIGZpbGw9J3doaXRlJyBoZWlnaHQ9JzI0cHgnIHZpZXdCb3g9JzAgMCAxOTIwIDE5MjAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zycgc3R5bGU9e3sgbWFyZ2luQm90dG9tOiBcIjRweFwiIH19PlxuICAgICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgICAgZD0nbTE3MzkuMzQgMTI5My40MTQtMTA1LjgyNyAxODAuODE4LTI0MC4yMjUtODAuMTg4LTI0LjUwOSAyMi4yNWMtNjkuOTEgNjMuNTg2LTE1MC4yMTEgMTA5LjY2Ni0yMzguNjQ0IDEzNi43NzFsLTMyLjA3NiA5Ljk0LTQ5LjQ2OCAyNDQuMDY1SDgzNS41ODRsLTQ5LjQ2OC0yNDQuMTc5LTMyLjA3Ni05LjkzOWMtODguNDMyLTI3LjEwNS0xNjguNzM0LTczLjE4NS0yMzguNjQ0LTEzNi43NzFsLTI0LjUwOC0yMi4yNS0yNDAuMjI2IDgwLjE4OS0xMDUuODI2LTE4MC44MiAxODkuNzQtMTY0LjQ0Mi03LjQ1My0zMi45NzhjLTEwLjM5LTQ1Ljc0Mi0xNS41ODYtOTEuNDgzLTE1LjU4Ni0xMzUuODY5IDAtNDQuMzg2IDUuMTk1LTkwLjEyNyAxNS41ODYtMTM1Ljg2OGw3LjQ1NC0zMi45NzktMTg5Ljc0MS0xNjQuNDQyIDEwNS44MjYtMTgwLjgxOSAyNDAuMjI2IDgwLjA3NSAyNC41MDgtMjIuMjVjNjkuOTEtNjMuNTg1IDE1MC4yMTItMTA5LjY2NSAyMzguNjQ0LTEzNi44ODRsMzIuMDc2LTkuODI2IDQ5LjQ2OC0yNDQuMDY2aDIxMy4wMDdsNDkuNDY4IDI0NC4xOCAzMi4wNzYgOS44MjVjODguNDMzIDI3LjIxOSAxNjguNzM0IDczLjE4NiAyMzguNjQ0IDEzNi44ODVsMjQuNTA5IDIyLjI1IDI0MC4yMjUtODAuMTg5IDEwNS44MjYgMTgwLjgxOS0xODkuNzQgMTY0LjQ0MiA3LjQ1MyAzMi45OGMxMC4zOSA0NS43NCAxNS41ODYgOTEuNDgxIDE1LjU4NiAxMzUuODY3IDAgNDQuMzg2LTUuMTk1IDkwLjEyNy0xNS41ODYgMTM1Ljg2OWwtNy40NTQgMzIuOTc4IDE4OS43NDEgMTY0LjU1NlptLTUzLjc2LTMzMy40MDNjMC00MS43ODgtMy44NC04NC40OC0xMS42MzQtMTI3LjI4NGwyMTAuMTg0LTE4Mi4wNjItMTk5LjQ1NC0zNDAuODU2LTI2NS4xODYgODguNDMzYy02Ni45NzQtNTUuNTY3LTE0My4zMjItOTkuMzg4LTIyMy44NS0xMjguNDE0TDExNDAuOTc3LjAxSDc0My4xOThsLTU0LjY2MyAyNjkuNzA0Yy04MS40MzEgMjkuMTM5LTE1Ni40MjQgNzIuMjgyLTIyMy45NjMgMTI4LjQxNEwxOTkuNSAzMDkuODA5LjA0NSA2NTAuNjY1bDIxMC4wNyAxODIuMDYyYy03LjY4IDQyLjgwNC0xMS41MiA4NS40OTYtMTEuNTIgMTI3LjI4NCAwIDQxLjc4OSAzLjg0IDg0LjQ4IDExLjUyIDEyNy4xNzJMLjA0NiAxMjY5LjM1NyAxOTkuNSAxNjEwLjIxNGwyNjUuMTg2LTg4LjU0NmM2Ni45NzQgNTUuNjggMTQzLjMyMyA5OS4zODggMjIzLjg1IDEyOC41MjdsNTQuNjYzIDI2OS44MTZoMzk3Ljc3OWw1NC42NjMtMjY5LjcwM2M4MS4zMTgtMjkuMjUyIDE1Ni40MjQtNzIuMjgzIDIyMy44NS0xMjguNTI3bDI2NS4xODYgODguNTQ2IDE5OS40NTQtMzQwLjg1Ny0yMTAuMTg0LTE4Mi4xNzRjNy43OTMtNDIuODA1IDExLjYzMy04NS40OTYgMTEuNjMzLTEyNy4yODVaTTk0Mi4wNzUgNTY0LjcwNkM3MjQuMSA1NjQuNzA2IDU0Ni43ODIgNzQyLjAyNCA1NDYuNzgyIDk2MGMwIDIxNy45NzYgMTc3LjMxOCAzOTUuMjk0IDM5NS4yOTQgMzk1LjI5NCAyMTcuOTc3IDAgMzk1LjI5NC0xNzcuMzE4IDM5NS4yOTQtMzk1LjI5NCAwLTIxNy45NzYtMTc3LjMxNy0zOTUuMjk0LTM5NS4yOTQtMzk1LjI5NG0wIDY3Ny42NDdjLTE1NS42MzMgMC0yODIuMzUzLTEyNi43Mi0yODIuMzUzLTI4Mi4zNTNzMTI2LjcyLTI4Mi4zNTMgMjgyLjM1My0yODIuMzUzUzEyMjQuNDMgODA0LjM2NyAxMjI0LjQzIDk2MHMtMTI2LjcyIDI4Mi4zNTMtMjgyLjM1MyAyODIuMzUzJ1xuICAgICAgICAgICAgICBmaWxsUnVsZT0nZXZlbm9kZCdcbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgU2V0dGluZ3NcbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPSdzaWRlX25hdmlnYXRpb25faXRlbScgb25DbGljaz17KCkgPT4gY2xlYXJDb3Vyc2VEYXRhKCl9PlxuICAgICAgICAgIDxzdmcgZmlsbD0nd2hpdGUnIGhlaWdodD0nMjRweCcgdmlld0JveD0nMCAwIDE5MjAgMTkyMCcgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJyBzdHlsZT17eyBtYXJnaW5Cb3R0b206IFwiNHB4XCIgfX0+XG4gICAgICAgICAgICA8cGF0aFxuICAgICAgICAgICAgICBkPSdNOTYwIDB2MTEyLjk0MWM0NjcuMTI1IDAgODQ3LjA1OSAzNzkuOTM0IDg0Ny4wNTkgODQ3LjA1OSAwIDQ2Ny4xMjUtMzc5LjkzNCA4NDcuMDU5LTg0Ny4wNTkgODQ3LjA1OS00NjcuMTI1IDAtODQ3LjA1OS0zNzkuOTM0LTg0Ny4wNTktODQ3LjA1OSAwLTI2Ny4xMDYgMTI2LjYwNy01MTUuOTE1IDMzOC44MjQtNjc1LjcyN3YzOTMuMzc0aDExMi45NFYxMTIuOTQxSDB2MTEyLjk0MWgzNDIuODlDMTI3LjA1OCA0MDcuMzggMCA2NzQuNzExIDAgOTYwYzAgNTI5LjM1NSA0MzAuNjQ1IDk2MCA5NjAgOTYwczk2MC00MzAuNjQ1IDk2MC05NjBTMTQ4OS4zNTUgMCA5NjAgMCdcbiAgICAgICAgICAgICAgZmlsbFJ1bGU9J2V2ZW5vZGQnXG4gICAgICAgICAgICAvPlxuICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgIFJlc2V0XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9uYXY+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT0nbmF2X3NwYWNlcicgc3R5bGU9e3sgbWluV2lkdGg6IFwiODVweFwiIH19PjwvZGl2PlxuICAgICAgPGRpdiBpZD0nbWFpbi1jb250ZW50JyBzdHlsZT17eyBhbGlnbkl0ZW1zOiAhY291cnNlRGF0YSA/IFwiY2VudGVyXCIgOiBcImluaGVyaXRcIiB9fT5cbiAgICAgICAge2NvdXJzZURhdGEgIT09IG51bGwgPyA8TWFpbkNvbnRlbnQgLz4gOiA8Q291cnNlUGlja2VyIC8+fVxuICAgICAgPC9kaXY+XG4gICAgPC8+XG4gICk7XG59XG5cbi8vIE91dGVyIHByb3ZpZGVyIHdyYXBwZXJcbmZ1bmN0aW9uIE9mZmxpbmVBcHAoKSB7XG4gIHJldHVybiAoXG4gICAgPENvdXJzZUNvbnRleHRQcm92aWRlcj5cbiAgICAgIDxOYXZpZ2F0aW9uUHJvdmlkZXI+XG4gICAgICAgIDxBcHBDb250ZW50IC8+XG4gICAgICA8L05hdmlnYXRpb25Qcm92aWRlcj5cbiAgICA8L0NvdXJzZUNvbnRleHRQcm92aWRlcj5cbiAgKTtcbn1cblxuY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJyb290XCIpO1xuY29uc3Qgcm9vdCA9IFJlYWN0RE9NLmNyZWF0ZVJvb3QoY29udGFpbmVyKTtcbnJvb3QucmVuZGVyKDxPZmZsaW5lQXBwIC8+KTtcbiIsIi8qKlxuICogUmVuZGVycyB0aGUgcGVyIGFzc2lnbm1lbnQgZGV0YWlscywgYWxsb3dpbmcgdXNlcnMgdG8gc2VlIHRoZSBkZXNjcmlwdGlvbiBhbmQgdGhlaXIgc3VibWlzc2lvbi5cbiAqIEBwYXJhbSB7T2JqZWN0fSBhc3NpZ25tZW50IC0gVGhlIGFzc2lnbm1lbnQgdG8gcmVuZGVyLlxuICogQHJldHVybnMge0pTWC5FbGVtZW50fG51bGx9IFRoZSBhc3NpZ25tZW50IGRldGFpbCB2aWV3LlxuICovXG5mdW5jdGlvbiBBc3NpZ25tZW50RGV0YWlsVmlldyh7IGFzc2lnbm1lbnQgfSkge1xuICBpZiAoIWFzc2lnbm1lbnQpIHtcbiAgICByZXR1cm4gPGgxPk5vIEFzc2lnbm1lbnQgU2VsZWN0ZWQ8L2gxPjtcbiAgfVxuICAvLyBkYXRlIG11c3QgYmUgaW4gZm9ybWF0IFNhdCBKdW4gMywgMjAyMyAxMjo1MHBtXG4gIC8vIGFzc2lnbm1lbnQ/LmR1ZV9hdCBpcyBpbiBmb3JtYXQgMjAyMy0wNi0wM1QxOTo1MDoxNS0wNDowMFxuICBmdW5jdGlvbiBjdXN0b21EYXRlRm9ybWF0KGRhdGUpIHtcbiAgICBjb25zdCBkYXRlT2JqID0gbmV3IERhdGUoZGF0ZSk7XG4gICAgY29uc3QgZGF5T2ZXZWVrID0gZGF0ZU9iai50b0xvY2FsZURhdGVTdHJpbmcoXCJlbi1VU1wiLCB7XG4gICAgICB3ZWVrZGF5OiBcInNob3J0XCIsXG4gICAgfSk7XG4gICAgY29uc3QgbW9udGggPSBkYXRlT2JqLnRvTG9jYWxlRGF0ZVN0cmluZyhcImVuLVVTXCIsIHsgbW9udGg6IFwic2hvcnRcIiB9KTtcbiAgICBjb25zdCBkYXkgPSBkYXRlT2JqLnRvTG9jYWxlRGF0ZVN0cmluZyhcImVuLVVTXCIsIHsgZGF5OiBcIm51bWVyaWNcIiB9KTtcbiAgICBjb25zdCB5ZWFyID0gZGF0ZU9iai50b0xvY2FsZURhdGVTdHJpbmcoXCJlbi1VU1wiLCB7IHllYXI6IFwibnVtZXJpY1wiIH0pO1xuICAgIGNvbnN0IHRpbWUgPSBkYXRlT2JqLnRvTG9jYWxlVGltZVN0cmluZyhcImVuLVVTXCIsIHtcbiAgICAgIGhvdXI6IFwibnVtZXJpY1wiLFxuICAgICAgbWludXRlOiBcIm51bWVyaWNcIixcbiAgICB9KTtcbiAgICByZXR1cm4gYCR7ZGF5T2ZXZWVrfSAke21vbnRofSAke2RheX0sICR7eWVhcn0gJHt0aW1lfWA7XG4gIH1cbiAgZnVuY3Rpb24gcG9pbnRzRGlzcGxheShhc3NpZ25tZW50KSB7XG4gICAgaWYgKGFzc2lnbm1lbnQ/LmdyYWRpbmdfdHlwZSA9PSBcInBvaW50c1wiKSB7XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8PlxuICAgICAgICAgIDxzdHJvbmc+XG4gICAgICAgICAgICB7YXNzaWdubWVudD8uc3VibWlzc2lvbj8uc2NvcmUgfHwgKGFzc2lnbm1lbnQ/LnN1Ym1pc3Npb24/Lm1pc3NpbmcgPyBcIjBcIiA6IFwiLVwiKX0ve2Fzc2lnbm1lbnQ/LnBvaW50c19wb3NzaWJsZX1cbiAgICAgICAgICA8L3N0cm9uZz5cbiAgICAgICAgICB7XCIgUG9pbnRzXCJ9XG4gICAgICAgIDwvPlxuICAgICAgKTtcbiAgICB9XG4gICAgaWYgKGFzc2lnbm1lbnQ/LmdyYWRpbmdfdHlwZSA9PSBcIm5vdF9ncmFkZWRcIikge1xuICAgICAgcmV0dXJuIDw+PC8+O1xuICAgIH1cbiAgICBpZiAoYXNzaWdubWVudD8uZ3JhZGluZ190eXBlID09IFwicGFzc19mYWlsXCIpIHtcbiAgICAgIHJldHVybiA8Pnthc3NpZ25tZW50Py5zdWJtaXNzaW9uPy5ncmFkZSA9PSBcImNvbXBsZXRlXCIgPyBcIkNvbXBsZXRlXCIgOiBcIkluY29tcGxldGVcIn08Lz47XG4gICAgfVxuICAgIHJldHVybiA8PmVycm9yPC8+O1xuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICBzdHlsZT17e1xuICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIixcbiAgICAgICAgd2lkdGg6IFwiMTAwJVwiLFxuICAgICAgICBtYXJnaW5Cb3R0b206IFwiOGVtXCIsXG4gICAgICB9fVxuICAgID5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPSdhc3NpZ25tZW50LXN0dWRlbnQtaGVhZGVyJz5cbiAgICAgICAgPHNwYW4gc3R5bGU9e3sgZGlzcGxheTogXCJmbGV4XCIsIGZsZXhEaXJlY3Rpb246IFwiY29sdW1uXCIgfX0+XG4gICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPSdhc3NpZ25tZW50LXN0dWRlbnQtaGVhZGVyLXRpdGxlJz57YXNzaWdubWVudD8ubmFtZX08L3NwYW4+XG4gICAgICAgICAgPHNwYW4gc3R5bGU9e3sgZm9udFNpemU6IFwiMTRweFwiLCBmb250V2VpZ2h0OiBcImJvbGRcIiB9fT5cbiAgICAgICAgICAgIER1ZToge2Fzc2lnbm1lbnQ/LmR1ZV9hdCA/IGN1c3RvbURhdGVGb3JtYXQoYXNzaWdubWVudD8uZHVlX2F0KSA6IFwiTm90IFNldFwifVxuICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgPC9zcGFuPlxuICAgICAgICA8c3BhblxuICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICAgIGZsZXhEaXJlY3Rpb246IFwicm93XCIsXG4gICAgICAgICAgICBhbGlnbkl0ZW1zOiBcImNlbnRlclwiLFxuICAgICAgICAgICAgZ2FwOiBcIjAuNWVtXCIsXG4gICAgICAgICAgfX1cbiAgICAgICAgPlxuICAgICAgICAgIDxzcGFuPlxuICAgICAgICAgICAge2Fzc2lnbm1lbnQuc3VibWlzc2lvbj8ubGF0ZSAmJiAhYXNzaWdubWVudC5zdWJtaXNzaW9uPy5taXNzaW5nICYmIDxDb250ZXh0UGlsbCB0eXBlPSdsYXRlJyAvPn1cbiAgICAgICAgICAgIHthc3NpZ25tZW50LnN1Ym1pc3Npb24/Lm1pc3NpbmcgJiYgPENvbnRleHRQaWxsIHR5cGU9J21pc3NpbmcnIC8+fVxuICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICA8c3BhblxuICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgZm9udFNpemU6IFwiMS41ZW1cIixcbiAgICAgICAgICAgICAgdGV4dEFsaWduOiBcInJpZ2h0XCIsXG4gICAgICAgICAgICB9fVxuICAgICAgICAgID5cbiAgICAgICAgICAgIHtwb2ludHNEaXNwbGF5KGFzc2lnbm1lbnQpfVxuICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgPC9zcGFuPlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzTmFtZT0nYXNzaWdubWVudC1pbmZvcm1hdGlvbidcbiAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICBmbGV4RGlyZWN0aW9uOiBcImNvbHVtblwiLFxuICAgICAgICAgIGFsaWduSXRlbXM6IFwibGVmdFwiLFxuICAgICAgICAgIHBhZGRpbmc6IFwiMWVtXCIsXG4gICAgICAgIH19XG4gICAgICA+XG4gICAgICAgIHt0eXBlb2YgYXNzaWdubWVudD8ubG9ja19leHBsYW5hdGlvbiA9PT0gXCJzdHJpbmdcIiAmJiA8c3Bhbj57YXNzaWdubWVudC5sb2NrX2V4cGxhbmF0aW9ufTwvc3Bhbj59XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPSdhc3NpZ25tZW50LWRldGFpbHMnIGRhbmdlcm91c2x5U2V0SW5uZXJIVE1MPXt7IF9faHRtbDogYXNzaWdubWVudD8uZGVzY3JpcHRpb24gfX0gLz5cbiAgICAgIDxBc3NpZ25tZW50UnVicmljIHJ1YnJpYz17YXNzaWdubWVudD8ucnVicmljfSAvPlxuICAgICAge2Fzc2lnbm1lbnQ/LnN1Ym1pc3Npb24/LmF0dGFjaG1lbnRzICYmIDxDYW52YXNTdWJtaXNzaW9uIGFzc2lnbm1lbnQ9e2Fzc2lnbm1lbnR9IC8+fVxuICAgICAgey8qPHNwYW4+RGVidWc6IHthc3NpZ25tZW50Py5pZH08L3NwYW4+Ki99XG4gICAgPC9kaXY+XG4gICk7XG59XG4iLCIvKipcbiAqIE1haW4gZnVuY3Rpb24gdGhhdCByZW5kZXJzIHRoZSBhc3NpZ25tZW50cyBwYWdlLlxuICogQHJldHVybnMgVGhlIG1haW4gQXNzaWdubWVudHMgcGFnZSBjb21wb25lbnQgZm9yIHRoZSB2aWV3ZXIuXG4gKi9cblxuZnVuY3Rpb24gQXNzaWdubWVudHNQYWdlKCkge1xuICBjb25zdCB7IGNvdXJzZURhdGEgfSA9IHVzZUNvdXJzZUNvbnRleHQoKTtcbiAgaWYgKCFjb3Vyc2VEYXRhKSB7XG4gICAgcmV0dXJuIDxkaXY+TG9hZGluZy4uLjwvZGl2PjtcbiAgfVxuICBpZiAoIWNvdXJzZURhdGEuQXNzaWdubWVudHMpIHtcbiAgICByZXR1cm4gPGRpdj5ObyBhc3NpZ25tZW50cyBhdmFpbGFibGUuPC9kaXY+O1xuICB9XG4gIC8vIENvbnZlcnQgZGljdGlvbmFyeSBvYmplY3Qgb3IgYXJyYXkgaW50byBhIGZsYXQgYXJyYXkgb2YgYXNzaWdubWVudHNcbiAgY29uc3QgYXNzaWdubWVudExpc3QgPSBBcnJheS5pc0FycmF5KGNvdXJzZURhdGEuQXNzaWdubWVudHMpID8gY291cnNlRGF0YS5Bc3NpZ25tZW50cyA6IE9iamVjdC52YWx1ZXMoY291cnNlRGF0YS5Bc3NpZ25tZW50cyk7XG4gIC8vIHNvcnQgYXNzaWdubWVudHMgYnkgcmV2ZXJzZSBkdWUgZGF0ZSBvcmRlclxuICBhc3NpZ25tZW50TGlzdC5zb3J0KChhLCBiKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBEYXRlKGIuZHVlX2F0KSAtIG5ldyBEYXRlKGEuZHVlX2F0KTtcbiAgfSk7XG4gIGlmIChjb3Vyc2VEYXRhLkFzc2lnbm1lbnRzKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYgY2xhc3NOYW1lPSdwYWdlLWRpdicgc3R5bGU9e3sgbWFyZ2luQm90dG9tOiBcIjRlbVwiIH19PlxuICAgICAgICA8aDEgc3R5bGU9e3sgY29sb3I6IFwiIzY2NjY2NlwiLCBmb250U2l6ZTogMjguOCB9fT5Bc3NpZ25tZW50czwvaDE+XG4gICAgICAgIDxDb2xsYXBzZVRhYmxlIHRpdGxlPSdBc3NpZ25tZW50cyc+XG4gICAgICAgICAge2Fzc2lnbm1lbnRMaXN0Lm1hcCgoYXNzaWdubWVudCwgaW5kZXgpID0+IChcbiAgICAgICAgICAgIDxDb2xsYXBzZUxpc3RJdGVtRGV0YWlsc1xuICAgICAgICAgICAgICBrZXk9e2Fzc2lnbm1lbnQuaWR9XG4gICAgICAgICAgICAgIGNsb3NlZD17YXNzaWdubWVudD8uYXZhaWxhYmlsaXR5X3N0YXR1cz8uc3RhdHVzIHx8IFwiVW5rbm93blwifSAvLyBVc2VzICdhdmFpbGFiaWxpdHlfc3RhdHVzLnN0YXR1cycgZnJvbSBDYW52YXMgSlNPTlxuICAgICAgICAgICAgICB0aXRsZT17YXNzaWdubWVudD8ubmFtZSB8fCBcIk5vIFRpdGxlXCJ9IC8vIFVzZXMgJ25hbWUnIGZyb20gQ2FudmFzIEpTT05cbiAgICAgICAgICAgICAgZHVlRGF0ZT17YXNzaWdubWVudD8uZHVlX2F0ID8gZml4RGF0ZUZvcm1hdChhc3NpZ25tZW50Py5kdWVfYXQpIDogXCJObyBEdWUgRGF0ZVwifVxuICAgICAgICAgICAgICBncmFkZT17YXNzaWdubWVudD8uc3VibWlzc2lvbj8uc2NvcmUgfHwgXCItXCJ9XG4gICAgICAgICAgICAgIG1heEdyYWRlPXthc3NpZ25tZW50Py5wb2ludHNfcG9zc2libGV9IC8vIFVzZXMgJ3BvaW50c19wb3NzaWJsZScgZnJvbSBDYW52YXMgSlNPTlxuICAgICAgICAgICAgICBhc3NpZ25tZW50PXthc3NpZ25tZW50fVxuICAgICAgICAgICAgICB0eXBlPXtcImFzc2lnbm1lbnRcIn1cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgKSl9XG4gICAgICAgIDwvQ29sbGFwc2VUYWJsZT5cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH1cbn1cbiIsIi8qKlxuICogRGlzcGxheXMgYSB0aHJlYWRkZWQgdmlldyBvZiB0aGUgY3VycmVudGx5IHNlbGVjdGVkIGRpc2N1c3Npb25cbiAqIEBwYXJhbSB7bnVtYmVyfSBkaXNjdXNzaW9uSWQgLSBUaGUgSUQgb2YgdGhlIGRpc2N1c3Npb24gdG8gZGlzcGxheS5cbiAqIEByZXR1cm5zIEEgUmVhY3QgY29tcG9uZW50IHRoYXQgZGlzcGxheXMgYSB0aHJlYWRkZWQgdmlldyBvZiB0aGUgY3VycmVudGx5IHNlbGVjdGVkIGRpc2N1c3Npb24uXG4gKi9cbmZ1bmN0aW9uIERpc2N1c3Npb25EZXRhaWxWaWV3KHsgZGlzY3Vzc2lvbklkIH0pIHtcbiAgY29uc3QgeyBjb3Vyc2VEYXRhIH0gPSB1c2VDb3Vyc2VDb250ZXh0KCk7XG4gIGlmICghY291cnNlRGF0YSkge1xuICAgIHJldHVybiA8ZGl2PkxvYWRpbmcuLi48L2Rpdj47XG4gIH1cbiAgaWYgKCFjb3Vyc2VEYXRhLkRpc2N1c3Npb25zKSB7XG4gICAgcmV0dXJuIDxkaXY+Tm8gZGlzY3Vzc2lvbnMgYXZhaWxhYmxlLjwvZGl2PjtcbiAgfVxuICBjb25zdCBkaXNjdXNzaW9uID0gY291cnNlRGF0YS5EaXNjdXNzaW9uc1tkaXNjdXNzaW9uSWRdO1xuXG4gIGZ1bmN0aW9uIHJlbmRlckRpc2N1c3Npb25Cb2R5KCkge1xuICAgIGNvbnN0IHZpZXcgPSBkaXNjdXNzaW9uPy52aWV3Py52aWV3OyAvLyBMaXN0IG9mIGFsbCByZXBsaWVzXG4gICAgY29uc3QgcGFydGljaXBhbnRzID0gZGlzY3Vzc2lvbj8udmlldz8ucGFydGljaXBhbnRzOyAvLyBMaXN0IG9mIGFsbCBwYXJ0aWNpcGFudHNcbiAgICBpZiAoIXZpZXcpIHtcbiAgICAgIHJldHVybiA8ZGl2Pk5vIGRpc2N1c3Npb24gYm9keSBhdmFpbGFibGUuPC9kaXY+O1xuICAgIH1cbiAgICBpZiAoIXBhcnRpY2lwYW50cykge1xuICAgICAgcmV0dXJuIDxkaXY+Tm8gcGFydGljaXBhbnRzIGF2YWlsYWJsZS48L2Rpdj47XG4gICAgfVxuICAgIHJldHVybiB2aWV3Lm1hcCgocmVwbHkpID0+IHtcbiAgICAgIGNvbnN0IFtyZXBsaWVzSGlkZGVuLCBzZXRIaWRkZW5dID0gdXNlU3RhdGUodHJ1ZSk7XG4gICAgICBpZiAocmVwbHk/LmRlbGV0ZWQpIHtcbiAgICAgICAgcmV0dXJuIFwiXCI7XG4gICAgICB9XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8ZGl2XG4gICAgICAgICAga2V5PXtyZXBseS5pZH1cbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCByZ2IoMjM1LCAyMzYsIDIzNylcIixcbiAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCI0cHhcIixcbiAgICAgICAgICAgIHBhZGRpbmc6IFwiMWVtXCIsXG4gICAgICAgICAgICBtYXJnaW5Ub3A6IFwiMWVtXCIsXG4gICAgICAgICAgICBmbGV4RGlyZWN0aW9uOiBcImNvbHVtblwiLFxuICAgICAgICAgIH19XG4gICAgICAgID5cbiAgICAgICAgICA8TmFtZVByb2ZpbGVDYXJkXG4gICAgICAgICAgICBuYW1lPXtwYXJ0aWNpcGFudHMuZmluZCgocGFydGljaXBhbnQpID0+IHBhcnRpY2lwYW50LmlkID09PSByZXBseT8udXNlcl9pZCk/LmRpc3BsYXlfbmFtZSB8fCBcIlVua25vd25cIn1cbiAgICAgICAgICAgIGRhdGU9e3JlcGx5LmNyZWF0ZWRfYXR9XG4gICAgICAgICAgLz5cbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICBjbGFzc05hbWU9J2Rpc2N1c3Npb24tZGVzY3JpcHRpb24nXG4gICAgICAgICAgICBzdHlsZT17eyBtYXJnaW5Cb3R0b206IFwiMGVtXCIsIG1heFdpZHRoOiBcIjEwMCVcIiB9fVxuICAgICAgICAgICAgZGFuZ2Vyb3VzbHlTZXRJbm5lckhUTUw9e3sgX19odG1sOiByZXBseT8ubWVzc2FnZSB9fVxuICAgICAgICAgID48L2Rpdj5cbiAgICAgICAgICB7cmVwbHk/LnJlcGxpZXMgJiYgcmVwbHk/LnJlcGxpZXM/Lmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgICAgPGFcbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4ge1xuICAgICAgICAgICAgICAgIHNldEhpZGRlbighcmVwbGllc0hpZGRlbik7XG4gICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgIGNsYXNzTmFtZT0nYXNzaWdubWVudC1saW5rJ1xuICAgICAgICAgICAgICBzdHlsZT17eyBkaXNwbGF5OiBcImZsZXhcIiwgYWxpZ25JdGVtczogXCJjZW50ZXJcIiwgZ2FwOiBcIjVweFwiIH19XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIHtyZXBsaWVzSGlkZGVuID8gXCJTaG93IFJlcGxpZXMgXCIgOiBcIkhpZGUgUmVwbGllc1wifVxuICAgICAgICAgICAgICA8c3ZnXG4gICAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgIGhlaWdodDogXCIxNXB4XCIsXG4gICAgICAgICAgICAgICAgICB3aWR0aDogXCIxNXB4XCIsXG4gICAgICAgICAgICAgICAgICBmaWxsOiBcInJnYigxNCwgMTA0LCAxNzkpXCIsXG4gICAgICAgICAgICAgICAgICB0cmFuc2Zvcm06IHJlcGxpZXNIaWRkZW4gPyBcInJvdGF0ZSgwZGVnKVwiIDogXCJyb3RhdGUoOTBkZWcpXCIsXG4gICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICB2aWV3Qm94PScwIDAgMTkyMCAxOTIwJ1xuICAgICAgICAgICAgICAgIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZydcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxwYXRoIGQ9J001MjYuMjk5IDAgNDM0IDkyLjE2OGw4NjcuNjM2IDg2Ny43NjdMNDM0IDE4MjcuNTdsOTIuMjk5IDkyLjQzIDk1OS45MzUtOTYwLjA2NXonIGZpbGw9J2N1cnJlbnRDb2xvcicgLz5cbiAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICA8L2E+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7IXJlcGxpZXNIaWRkZW4gJiZcbiAgICAgICAgICAgIHJlcGx5Py5yZXBsaWVzPy5tYXAoKHJlcGx5KSA9PiB7XG4gICAgICAgICAgICAgIGlmIChyZXBseT8uZGVsZXRlZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBcIlwiO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICAgICAga2V5PXtyZXBseS5pZH1cbiAgICAgICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgcmdiKDIzNSwgMjM2LCAyMzcpXCIsXG4gICAgICAgICAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCI0cHhcIixcbiAgICAgICAgICAgICAgICAgICAgcGFkZGluZzogXCIxZW1cIixcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luVG9wOiBcIjFlbVwiLFxuICAgICAgICAgICAgICAgICAgICBmbGV4RGlyZWN0aW9uOiBcImNvbHVtblwiLFxuICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICA8TmFtZVByb2ZpbGVDYXJkXG4gICAgICAgICAgICAgICAgICAgIG5hbWU9e3BhcnRpY2lwYW50cy5maW5kKChwYXJ0aWNpcGFudCkgPT4gcGFydGljaXBhbnQuaWQgPT09IHJlcGx5Py51c2VyX2lkKT8uZGlzcGxheV9uYW1lIHx8IFwiVW5rbm93blwifVxuICAgICAgICAgICAgICAgICAgICBkYXRlPXtyZXBseS5jcmVhdGVkX2F0fVxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPSdkaXNjdXNzaW9uLWRlc2NyaXB0aW9uJ1xuICAgICAgICAgICAgICAgICAgICBzdHlsZT17eyBtYXJnaW5Cb3R0b206IFwiMGVtXCIsIG1heFdpZHRoOiBcIjEwMCVcIiB9fVxuICAgICAgICAgICAgICAgICAgICBkYW5nZXJvdXNseVNldElubmVySFRNTD17eyBfX2h0bWw6IHJlcGx5Py5tZXNzYWdlIH19XG4gICAgICAgICAgICAgICAgICA+PC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9KX1cbiAgICAgICAgPC9kaXY+XG4gICAgICApO1xuICAgIH0pO1xuICB9XG4gIGNvbnNvbGUubG9nKFwiUmVuZGVyaW5nIERpc2N1c3Npb24gSUQ6IFwiLCBkaXNjdXNzaW9uSWQpO1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPSdwYWdlLWRpdicgc3R5bGU9e3sgbWFyZ2luQm90dG9tOiBcIjRlbVwiIH19PlxuICAgICAgPGRpdlxuICAgICAgICBjbGFzc05hbWU9J2Rpc2N1c3Npb24taGVhZGVyJ1xuICAgICAgICBzdHlsZT17e1xuICAgICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICAgIGFsaWduSXRlbXM6IFwibGVmdFwiLFxuICAgICAgICAgIG1hcmdpbkJvdHRvbTogXCIxcmVtXCIsXG4gICAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCByZ2IoMjM1LCAyMzYsIDIzNylcIixcbiAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiNHB4XCIsXG4gICAgICAgICAgcGFkZGluZzogXCIxZW1cIixcbiAgICAgICAgICBtYXJnaW5Ub3A6IFwiMmVtXCIsXG4gICAgICAgICAgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIixcbiAgICAgICAgfX1cbiAgICAgID5cbiAgICAgICAgPGRpdlxuICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICAgIGZsZXhEaXJlY3Rpb246IFwicm93XCIsXG4gICAgICAgICAgICBqdXN0aWZ5Q29udGVudDogXCJzcGFjZS1iZXR3ZWVuXCIsXG4gICAgICAgICAgICBjb2xvcjogXCJyZ2IoMzksIDUzLCA2NClcIixcbiAgICAgICAgICAgIG1hcmdpbkJvdHRvbTogXCIxZW1cIixcbiAgICAgICAgICB9fVxuICAgICAgICA+XG4gICAgICAgICAgPHNwYW4+RHVlIHtmaXhEYXRlRm9ybWF0KGRpc2N1c3Npb24/LmFzc2lnbm1lbnQ/LmR1ZV9hdCkgfHwgXCJOZXZlclwifTwvc3Bhbj5cbiAgICAgICAgICA8c3BhbiBzdHlsZT17eyBmb250U2l6ZTogXCIxNHB4XCIgfX0+e2Rpc2N1c3Npb24/LmFzc2lnbm1lbnQ/LnBvaW50c19wb3NzaWJsZSB8fCBcIjBcIn0gUG9pbnRzIFBvc3NpYmxlPC9zcGFuPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPE5hbWVQcm9maWxlQ2FyZFxuICAgICAgICAgIG5hbWU9e2Rpc2N1c3Npb24/LmF1dGhvcj8uZGlzcGxheV9uYW1lIHx8IFwiQW5vbm55bW91c1wifVxuICAgICAgICAgIGRhdGU9e2Rpc2N1c3Npb24/LmRlbGF5ZWRfcG9zdF9hdCB8fCBkaXNjdXNzaW9uPy5jcmVhdGVkX2F0IHx8IGRpc2N1c3Npb24/Lmxhc3RfcmVwbHlfYXQgfHwgZGlzY3Vzc2lvbj8ucG9zdGVkX2F0fVxuICAgICAgICAvPlxuICAgICAgICA8aDIgc3R5bGU9e3sgY29sb3I6IFwicmdiKDM5LCA1MywgNjQpXCIsIGZvbnRTaXplOiBcIjI4LjhweFwiLCBtYXJnaW5Cb3R0b206IFwiMGVtXCIgfX0+e2Rpc2N1c3Npb24/LnRpdGxlfTwvaDI+XG4gICAgICAgIDxkaXZcbiAgICAgICAgICBjbGFzc05hbWU9J2Rpc2N1c3Npb24tZGVzY3JpcHRpb24nXG4gICAgICAgICAgZGFuZ2Vyb3VzbHlTZXRJbm5lckhUTUw9e3sgX19odG1sOiBkaXNjdXNzaW9uPy5tZXNzYWdlIHx8IFwiTm8gZGlzY3JpcHRpb24gcHJvdmlkZWQuXCIgfX1cbiAgICAgICAgPjwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzTmFtZT0nZGlzY3Vzc2lvbi1ib2R5J1xuICAgICAgICBzdHlsZT17e1xuICAgICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICAgIGFsaWduSXRlbXM6IFwibGVmdFwiLFxuICAgICAgICAgIG1hcmdpbkJvdHRvbTogXCIxcmVtXCIsXG4gICAgICAgICAgcGFkZGluZzogXCIxZW1cIixcbiAgICAgICAgICBtYXJnaW5Ub3A6IFwiMmVtXCIsXG4gICAgICAgICAgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIixcbiAgICAgICAgfX1cbiAgICAgID5cbiAgICAgICAge3JlbmRlckRpc2N1c3Npb25Cb2R5KCl9XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cbiIsIi8qKlxuICogQ3JlYXRlcyB0aGUgZGlzY3Vzc2lvbnMgcGFnZSwgd2hpY2ggbGlzdHMgYWxsIHRoZSBkaXNjdXNzaW9ucyBpbiBhIGNvdXJzZS5cbiAqIEByZXR1cm5zIHtSZWFjdC5Db21wb25lbnR9IHRoZSBkaXNjdXNzaW9ucyBwYWdlXG4gKi9cblxuZnVuY3Rpb24gRGlzY3Vzc2lvbnNQYWdlKCkge1xuICBjb25zdCB7IGNvdXJzZURhdGEsIHJlY29ubmVjdEZvbGRlciB9ID0gdXNlQ291cnNlQ29udGV4dCgpO1xuICBjb25zdCB7IG5hdmlnYXRlVG9EaXNjdXNzaW9uIH0gPSB1c2VOYXZpZ2F0aW9uKCk7XG4gIGlmICghY291cnNlRGF0YSkge1xuICAgIHJldHVybiA8ZGl2PkxvYWRpbmcuLi48L2Rpdj47XG4gIH1cbiAgaWYgKCFjb3Vyc2VEYXRhLkRpc2N1c3Npb25zIHx8IE9iamVjdC5rZXlzKGNvdXJzZURhdGE/LkRpc2N1c3Npb25zIHx8IHt9KS5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gPGRpdj5ObyBkaXNjdXNzaW9ucyBhdmFpbGFibGUuPC9kaXY+O1xuICB9XG4gIC8vIENvbnZlcnQgZGljdGlvbmFyeSBvYmplY3Qgb3IgYXJyYXkgaW50byBhIGZsYXQgYXJyYXkgb2YgYXNzaWdubWVudHNcbiAgY29uc3QgZGlzY3Vzc2lvbkxpc3QgPSBBcnJheS5pc0FycmF5KGNvdXJzZURhdGEuRGlzY3Vzc2lvbnMpID8gY291cnNlRGF0YS5EaXNjdXNzaW9ucyA6IE9iamVjdC52YWx1ZXMoY291cnNlRGF0YS5EaXNjdXNzaW9ucyk7XG4gIC8vIHNvcnQgZGlzY3Vzc2lvbnMgYnkgcmV2ZXJzZSBkdWUgZGF0ZSBvcmRlclxuICBkaXNjdXNzaW9uTGlzdC5zb3J0KChhLCBiKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBEYXRlKGIuZHVlX2F0KSAtIG5ldyBEYXRlKGEuZHVlX2F0KTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gRGlzY3Vzc2lvblRhYmxlSXRlbURldGFpbHMoeyBkaXNjdXNzaW9uIH0pIHtcbiAgICBjb25zdCBpbmRlbnQgPSAwO1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzTmFtZT0nYXNzaWdubWVudC1kZXRhaWxzJ1xuICAgICAgICBzdHlsZT17e1xuICAgICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICAgIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsXG4gICAgICAgICAgcGFkZGluZ0xlZnQ6IGAke2luZGVudCAqIDF9ZW1gLFxuICAgICAgICAgIGp1c3RpZnlDb250ZW50OiBcInNwYWNlLWJldHdlZW5cIixcbiAgICAgICAgICB3aWR0aDogXCIxMDAlXCIsXG4gICAgICAgIH19XG4gICAgICA+XG4gICAgICAgIDxkaXZcbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsXG4gICAgICAgICAgICBhbGlnbkl0ZW1zOiBcImNlbnRlclwiLFxuICAgICAgICAgIH19XG4gICAgICAgID5cbiAgICAgICAgICA8Q2FudmFzSXRlbUljb24gaWNvbl90eXBlPXtcImRpc2N1c3Npb25cIn0gLz5cbiAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgPGgzXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT0nYXNzaWdubWVudC1pbmZvLXRpdGxlJ1xuICAgICAgICAgICAgICBzdHlsZT17eyBmb250U2l6ZTogXCIxNnB4XCIsIG1hcmdpbjogXCIwXCIsIGNvbG9yOiBcIiMyNzM0NTBcIiwgY3Vyc29yOiBcInBvaW50ZXJcIiB9fVxuICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVjb25uZWN0Rm9sZGVyKCk7XG4gICAgICAgICAgICAgICAgaWYgKGRpc2N1c3Npb24/LmlkKSB7XG4gICAgICAgICAgICAgICAgICBuYXZpZ2F0ZVRvRGlzY3Vzc2lvbihkaXNjdXNzaW9uLmlkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH19XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIHtkaXNjdXNzaW9uLnRpdGxlfVxuICAgICAgICAgICAgPC9oMz5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT0nYXNzaWdubWVudC1pbmZvLWl0ZW0nIHN0eWxlPXt7IGNvbG9yOiBcIiM2NjY2NjZcIiwgZm9udFNpemU6IDE0LCBtYXJnaW5MZWZ0OiBcIjBlbVwiIH19PlxuICAgICAgICAgICAgICA8c3Ryb25nPkxhc3QgcG9zdCBhdCB7ZGlzY3Vzc2lvbj8ubGFzdF9yZXBseV9hdCA/IGZpeERhdGVGb3JtYXQoZGlzY3Vzc2lvbj8ubGFzdF9yZXBseV9hdCkgOiBcIi1cIn08L3N0cm9uZz5cbiAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXZcbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsXG4gICAgICAgICAgICBhbGlnbkl0ZW1zOiBcImZsZXgtZW5kXCIsXG4gICAgICAgICAgICBmbGV4RGlyZWN0aW9uOiBcImNvbHVtblwiLFxuICAgICAgICAgICAgbWFyZ2luTGVmdDogXCIyZW1cIixcbiAgICAgICAgICAgIHRleHRBbGlnbjogXCJyaWdodFwiLFxuICAgICAgICAgICAganVzdGlmeUNvbnRlbnQ6IFwicmlnaHRcIixcbiAgICAgICAgICB9fVxuICAgICAgICA+XG4gICAgICAgICAge2Rpc2N1c3Npb24/LnZpZXcgJiYgKFxuICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT0nJyBzdHlsZT17eyBmb250U2l6ZTogXCIxNnB4XCIsIGZvbnRXZWlnaHQ6IFwibm9ybWFsXCIsIG1hcmdpbjogXCIwXCIsIGNvbG9yOiBcIiMyNzM0NTBcIiwgY3Vyc29yOiBcImRlZmF1bHRcIiB9fT5cbiAgICAgICAgICAgICAge2Rpc2N1c3Npb24/LnZpZXc/LnZpZXc/Lmxlbmd0aCB8fCBcIjBcIn0gUmVwbGllc1xuICAgICAgICAgICAgPC9oMz5cbiAgICAgICAgICApfVxuICAgICAgICAgIHtkaXNjdXNzaW9uPy5hc3NpZ25tZW50ICYmIChcbiAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9Jycgc3R5bGU9e3sgZm9udFNpemU6IFwiMTZweFwiLCBmb250V2VpZ2h0OiBcIm5vcm1hbFwiLCBtYXJnaW46IFwiMFwiLCBjb2xvcjogXCIjMjczNDUwXCIsIGN1cnNvcjogXCJkZWZhdWx0XCIgfX0+XG4gICAgICAgICAgICAgIER1ZSB7Zml4RGF0ZUZvcm1hdChkaXNjdXNzaW9uPy5hc3NpZ25tZW50Py5kdWVfYXQpfVxuICAgICAgICAgICAgPC9oMz5cbiAgICAgICAgICApfVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH1cblxuICBpZiAoY291cnNlRGF0YS5EaXNjdXNzaW9ucykge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzTmFtZT0ncGFnZS1kaXYnIHN0eWxlPXt7IG1hcmdpbkJvdHRvbTogXCI0ZW1cIiB9fT5cbiAgICAgICAgPGgxIHN0eWxlPXt7IGNvbG9yOiBcIiM2NjY2NjZcIiwgZm9udFNpemU6IDI4LjggfX0+RGlzY3Vzc2lvbnM8L2gxPlxuICAgICAgICA8Q29sbGFwc2VUYWJsZSB0aXRsZT0nRGlzY3Vzc2lvbnMnPlxuICAgICAgICAgIHtkaXNjdXNzaW9uTGlzdC5tYXAoKGRpc2N1c3Npb24sIGluZGV4KSA9PiAoXG4gICAgICAgICAgICA8RGlzY3Vzc2lvblRhYmxlSXRlbURldGFpbHMgZGlzY3Vzc2lvbj17ZGlzY3Vzc2lvbn0ga2V5PXtkaXNjdXNzaW9uLmlkfSAvPlxuICAgICAgICAgICkpfVxuICAgICAgICA8L0NvbGxhcHNlVGFibGU+XG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG59XG4iLCIvKipcbiAqIERpc3BsYXlzIHRoZSBsaXN0IG9mIGZpbGVzLiBUaGlzIHBhZ2UgaGFzIHRvIGhhbmRsZSBwYXJlbnQgZm9sZGVycywgYW5kIGZpbGVzIGluc2lkZSB0aG9zZSBwYXJlbnQgZm9sZGVycy5cbiAqIEByZXR1cm5zIHtSZWFjdC5Db21wb25lbnR9IFRoZSBmaWxlcyBwYWdlXG4gKi9cblxuZnVuY3Rpb24gRmlsZXNQYWdlKCkge1xuICBjb25zdCB7IGNvdXJzZURhdGEsIHJlY29ubmVjdEZvbGRlciB9ID0gdXNlQ291cnNlQ29udGV4dCgpO1xuICBjb25zdCB7IG5hdmlnYXRlVG9QYWdlIH0gPSB1c2VOYXZpZ2F0aW9uKCk7XG4gIGNvbnN0IFtzZWxlY3RlZEZpbGUsIHNldFNlbGVjdGVkRmlsZV0gPSB1c2VTdGF0ZShudWxsKTtcblxuICBpZiAoIWNvdXJzZURhdGEpIHtcbiAgICByZXR1cm4gPGRpdj5Mb2FkaW5nLi4uPC9kaXY+O1xuICB9XG4gIGlmICghY291cnNlRGF0YT8uRmlsZXMgfHwgKGNvdXJzZURhdGE/LkZpbGVzPy5maWxlcz8ubGVuZ3RoID09PSAwICYmIGNvdXJzZURhdGE/LkZpbGVzPy5mb2xkZXJzPy5sZW5ndGggPT09IDApKSB7XG4gICAgcmV0dXJuIDxkaXY+Tm8gZmlsZXMgYXZhaWxhYmxlLjwvZGl2PjtcbiAgfVxuICAvLyBGaW5kIHRoZSBJRCBvZiB0aGUgbWFpbiBmb2xkZXJcbiAgY29uc3Qgcm9vdEZvbGRlciA9IGNvdXJzZURhdGEuRmlsZXMuZm9sZGVycy5maW5kKChmb2xkZXIpID0+IGZvbGRlci5wYXJlbnRfZm9sZGVyX2lkID09PSBudWxsKTtcblxuICBjb25zdCBbYWN0aXZlRm9sZGVyLCBzZXRBY3RpdmVGb2xkZXJdID0gdXNlU3RhdGUocm9vdEZvbGRlciA/IHJvb3RGb2xkZXIuaWQgOiBudWxsKTtcblxuICAvLyBCdWlsZCB1bmlmaWVkIGxpc3Qgb2YgZmlsZXMgYW5kIGZvbGRlcnMsIHNvcnRlZCBieSBkaXNwbGF5IG5hbWVcbiAgY29uc3QgZmlsZXNBcnJheSA9IEFycmF5LmlzQXJyYXkoY291cnNlRGF0YS5GaWxlcy5maWxlcykgPyBjb3Vyc2VEYXRhLkZpbGVzLmZpbGVzIDogT2JqZWN0LnZhbHVlcyhjb3Vyc2VEYXRhLkZpbGVzLmZpbGVzKTtcbiAgY29uc3QgZm9sZGVyc0FycmF5ID0gQXJyYXkuaXNBcnJheShjb3Vyc2VEYXRhLkZpbGVzLmZvbGRlcnMpID8gY291cnNlRGF0YS5GaWxlcy5mb2xkZXJzIDogT2JqZWN0LnZhbHVlcyhjb3Vyc2VEYXRhLkZpbGVzLmZvbGRlcnMpO1xuICBjb25zdCBjb21iaW5lZExpc3QgPSBbLi4uZmlsZXNBcnJheSwgLi4uZm9sZGVyc0FycmF5XVxuICAgIC5tYXAoKGl0ZW0pID0+IHtcbiAgICAgIGlmIChpdGVtLmRpc3BsYXlfbmFtZSkge1xuICAgICAgICByZXR1cm4geyAuLi5pdGVtLCBfdHlwZTogXCJmaWxlXCIgfTtcbiAgICAgIH0gZWxzZSBpZiAoaXRlbS5uYW1lKSB7XG4gICAgICAgIHJldHVybiB7IC4uLml0ZW0sIF90eXBlOiBcImZvbGRlclwiLCBkaXNwbGF5X25hbWU6IGl0ZW0ubmFtZSB9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIHsgLi4uaXRlbSwgX3R5cGU6IFwidW5rbm93blwiIH07XG4gICAgfSlcbiAgICAuc29ydCgoYSwgYikgPT4gKGEuZGlzcGxheV9uYW1lIHx8IFwiXCIpLmxvY2FsZUNvbXBhcmUoYi5kaXNwbGF5X25hbWUgfHwgXCJcIikpO1xuXG4gIC8vIEZpbHRlciB0aGUgY29tYmluZWQgbGlzdCBieSBhY3RpdmVGb2xkZXJcbiAgY29uc3QgZmlsdGVyZWRMaXN0ID0gY29tYmluZWRMaXN0LmZpbHRlcigoaXRlbSkgPT4gaXRlbS5wYXJlbnRfZm9sZGVyX2lkID09PSBhY3RpdmVGb2xkZXIgfHwgaXRlbS5mb2xkZXJfaWQgPT09IGFjdGl2ZUZvbGRlcik7XG5cbiAgaWYgKHNlbGVjdGVkRmlsZSkge1xuICAgIHJldHVybiA8RmlsZXNQYWdlRGV0YWlsVmlldyBmaWxlPXtzZWxlY3RlZEZpbGV9IG9uQmFjaz17KCkgPT4gc2V0U2VsZWN0ZWRGaWxlKG51bGwpfSAvPjtcbiAgfVxuXG4gIHJldHVybiAoXG4gICAgPGRpdiBzdHlsZT17eyB3aWR0aDogXCIxMDAlXCIsIG1hcmdpbkJvdHRvbTogXCI4ZW1cIiB9fT5cbiAgICAgIDxkaXZcbiAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICBqdXN0aWZ5Q29udGVudDogXCJzcGFjZS1iZXR3ZWVuXCIsXG4gICAgICAgICAgYWxpZ25JdGVtczogXCJjZW50ZXJcIixcbiAgICAgICAgfX1cbiAgICAgID5cbiAgICAgICAgPGgxIHN0eWxlPXt7IGNvbG9yOiBcIiM2NjY2NjZcIiwgZm9udFNpemU6IDI4LjggfX0+RmlsZXMgJmFtcDsgRm9sZGVyczwvaDE+XG4gICAgICAgIHthY3RpdmVGb2xkZXIgIT09IHJvb3RGb2xkZXI/LmlkICYmIChcbiAgICAgICAgICA8c3BhblxuICAgICAgICAgICAgY2xhc3NOYW1lPSdhc3NpZ25tZW50LWxpbmsnXG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBmb250V2VpZ2h0OiBcImJvbGRcIixcbiAgICAgICAgICAgICAgY29sb3I6IFwiYmxhY2tcIixcbiAgICAgICAgICAgICAgbWFyZ2luUmlnaHQ6IFwiMmVtXCIsXG4gICAgICAgICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgcmdiKDIzMiwgMjM0LCAyMzYpXCIsXG4gICAgICAgICAgICAgIHBhZGRpbmc6IFwiMC4yNWVtXCIsXG4gICAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCI0cHhcIixcbiAgICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcInJnYigyNDIsIDI0NCwgMjQ0KVwiLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcbiAgICAgICAgICAgICAgc2V0QWN0aXZlRm9sZGVyKGZvbGRlcnNBcnJheS5maW5kKChmb2xkZXIpID0+IGZvbGRlci5pZCA9PT0gYWN0aXZlRm9sZGVyKT8ucGFyZW50X2ZvbGRlcl9pZCB8fCByb290Rm9sZGVyIHx8IG51bGwpO1xuICAgICAgICAgICAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICBCYWNrXG4gICAgICAgICAgPC9zcGFuPlxuICAgICAgICApfVxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT0ncGFnZXMtY29udGFpbmVyJyBzdHlsZT17eyB3aWR0aDogXCIxMDAlXCIgfX0+XG4gICAgICAgIDx0YWJsZSBjbGFzc05hbWU9J3BhZ2VzLXRhYmxlJyBzdHlsZT17eyB3aWR0aDogXCIxMDAlXCIgfX0+XG4gICAgICAgICAgPHRoZWFkPlxuICAgICAgICAgICAgPHRyIHN0eWxlPXt7IGJvcmRlckJvdHRvbTogXCIycHggc29saWQgcmdiKDM5LCA1MywgNjQpXCIgfX0+XG4gICAgICAgICAgICAgIDx0aCBzdHlsZT17eyBtaW5XaWR0aDogXCJmaXQtY29udGVudFwiLCB3aGl0ZVNwYWNlOiBcIm5vd3JhcFwiIH19PlRpdGxlPC90aD5cbiAgICAgICAgICAgICAgPHRoIHN0eWxlPXt7IG1pbldpZHRoOiBcImZpdC1jb250ZW50XCIsIHdoaXRlU3BhY2U6IFwibm93cmFwXCIgfX0+VHlwZTwvdGg+XG4gICAgICAgICAgICAgIDx0aCBzdHlsZT17eyBtaW5XaWR0aDogXCJmaXQtY29udGVudFwiLCB3aGl0ZVNwYWNlOiBcIm5vd3JhcFwiIH19PkNyZWF0aW9uIERhdGU8L3RoPlxuICAgICAgICAgICAgICA8dGggc3R5bGU9e3sgbWluV2lkdGg6IFwiZml0LWNvbnRlbnRcIiwgd2hpdGVTcGFjZTogXCJub3dyYXBcIiB9fT5VcGRhdGVkIGF0PC90aD5cbiAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgPC90aGVhZD5cbiAgICAgICAgICA8dGJvZHk+XG4gICAgICAgICAgICB7ZmlsdGVyZWRMaXN0Lm1hcCgoaXRlbSwgaW5kZXgpID0+IChcbiAgICAgICAgICAgICAgPHRyIGtleT17aXRlbS5pZCB8fCBpbmRleH0gc3R5bGU9e3sgYmFja2dyb3VuZENvbG9yOiBpbmRleCAlIDIgPT09IDAgPyBcIiNmMmY0ZjRcIiA6IFwid2hpdGVcIiB9fT5cbiAgICAgICAgICAgICAgICA8dGQ+XG4gICAgICAgICAgICAgICAgICB7aXRlbS5fdHlwZSA9PT0gXCJmb2xkZXJcIiA/IChcbiAgICAgICAgICAgICAgICAgICAgPGFcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9J2Fzc2lnbm1lbnQtbGluaydcbiAgICAgICAgICAgICAgICAgICAgICBzdHlsZT17eyBmb250V2VpZ2h0OiBcImJvbGRcIiwgY29sb3I6IFwiYmxhY2tcIiB9fVxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eyhlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWNvbm5lY3RGb2xkZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldEFjdGl2ZUZvbGRlcihpdGVtLmlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldFNlbGVjdGVkRmlsZShudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAge2l0ZW0uZGlzcGxheV9uYW1lfVxuICAgICAgICAgICAgICAgICAgICA8L2E+XG4gICAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgICA8YVxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT0nYXNzaWdubWVudC1saW5rJ1xuICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eyhlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWNvbm5lY3RGb2xkZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldFNlbGVjdGVkRmlsZShpdGVtKTtcbiAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAge2l0ZW0uZGlzcGxheV9uYW1lfVxuICAgICAgICAgICAgICAgICAgICA8L2E+XG4gICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgPHRkPntpdGVtLl90eXBlID09PSBcImZvbGRlclwiID8gXCJmb2xkZXJcIiA6IGl0ZW1bXCJjb250ZW50LXR5cGVcIl19PC90ZD5cbiAgICAgICAgICAgICAgICA8dGQgc3R5bGU9e3sgbWluV2lkdGg6IFwiZml0LWNvbnRlbnRcIiwgd2hpdGVTcGFjZTogXCJub3dyYXBcIiB9fT5cbiAgICAgICAgICAgICAgICAgIHtpdGVtLmNyZWF0ZWRfYXRcbiAgICAgICAgICAgICAgICAgICAgPyBuZXcgRGF0ZShpdGVtLmNyZWF0ZWRfYXQpLnRvTG9jYWxlRGF0ZVN0cmluZyhcImVuLVVTXCIsIHsgeWVhcjogXCJudW1lcmljXCIsIG1vbnRoOiBcInNob3J0XCIsIGRheTogXCJudW1lcmljXCIgfSlcbiAgICAgICAgICAgICAgICAgICAgOiBcIi1cIn1cbiAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT17eyBtaW5XaWR0aDogXCJmaXQtY29udGVudFwiLCB3aGl0ZVNwYWNlOiBcIm5vd3JhcFwiIH19PlxuICAgICAgICAgICAgICAgICAge2l0ZW0udXBkYXRlZF9hdFxuICAgICAgICAgICAgICAgICAgICA/IG5ldyBEYXRlKGl0ZW0udXBkYXRlZF9hdCkudG9Mb2NhbGVEYXRlU3RyaW5nKFwiZW4tVVNcIiwgeyB5ZWFyOiBcIm51bWVyaWNcIiwgbW9udGg6IFwic2hvcnRcIiwgZGF5OiBcIm51bWVyaWNcIiB9KVxuICAgICAgICAgICAgICAgICAgICA6IFwiLVwifVxuICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICApKX1cbiAgICAgICAgICAgIHtmaWx0ZXJlZExpc3QubGVuZ3RoID09PSAwICYmIChcbiAgICAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICAgIDx0ZCBjb2xTcGFuPXs0fT5cbiAgICAgICAgICAgICAgICAgIE5vIGZpbGVzIGluIHRoaXMgZm9sZGVyLHtcIiBcIn1cbiAgICAgICAgICAgICAgICAgIDxhXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT0nYXNzaWdubWVudC1saW5rJ1xuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PlxuICAgICAgICAgICAgICAgICAgICAgIHNldEFjdGl2ZUZvbGRlcihmb2xkZXJzQXJyYXkuZmluZCgoZm9sZGVyKSA9PiBmb2xkZXIuaWQgPT09IGFjdGl2ZUZvbGRlcik/LnBhcmVudF9mb2xkZXJfaWQgfHwgcm9vdEZvbGRlciB8fCBudWxsKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIEJhY2tcbiAgICAgICAgICAgICAgICAgIDwvYT5cbiAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICA8L3Rib2R5PlxuICAgICAgICA8L3RhYmxlPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59XG4iLCIvKipcbiAqIFRoZSBkZXRhaWwgdmlldyBmb3IgYSBmaWxlLiBJdCBkaXNwbGF5cyB0aGUgZmlsZSdzIGluZm9ybWF0aW9uIGFuZCB0aGUgZmlsZSBpdHNlbGYuIFV0aWxpemVzIHRoZSBMb2NhbEF0YXRjaG1lbnQgVmlld2VyIHdoaWNoIHdhcyBjcmVhdGVkIGZvciBzdWJtaXNzaW9uIHZpZXdpbmcuXG4gKiBAcGFyYW0geyp9IGZpbGUgLSBUaGUgZmlsZSB0byBkaXNwbGF5LlxuICogQHBhcmFtIHsqfSBvbkJhY2sgLSBUaGUgZnVuY3Rpb24gdG8gY2FsbCB3aGVuIHRoZSBiYWNrIGJ1dHRvbiBpcyBjbGlja2VkLlxuICogQHJldHVybnMge1JlYWN0LkNvbXBvbmVudH0gVGhlIGZpbGVzIHBhZ2UgZGV0YWlsIHZpZXdcbiAqL1xuZnVuY3Rpb24gRmlsZXNQYWdlRGV0YWlsVmlldyh7IGZpbGUsIG9uQmFjayB9KSB7XG4gIGlmICghZmlsZSkge1xuICAgIHJldHVybiA8aDE+Tm8gRmlsZSBTZWxlY3RlZDwvaDE+O1xuICB9XG5cbiAgY29uc3QgZm9ybWF0dGVkQ3JlYXRlZCA9IGZpbGUuY3JlYXRlZF9hdFxuICAgID8gbmV3IERhdGUoZmlsZS5jcmVhdGVkX2F0KS50b0xvY2FsZURhdGVTdHJpbmcoXCJlbi1VU1wiLCB7IHllYXI6IFwibnVtZXJpY1wiLCBtb250aDogXCJzaG9ydFwiLCBkYXk6IFwibnVtZXJpY1wiIH0pXG4gICAgOiBcIi1cIjtcbiAgY29uc3QgZm9ybWF0dGVkVXBkYXRlZCA9IGZpbGUudXBkYXRlZF9hdFxuICAgID8gbmV3IERhdGUoZmlsZS51cGRhdGVkX2F0KS50b0xvY2FsZURhdGVTdHJpbmcoXCJlbi1VU1wiLCB7IHllYXI6IFwibnVtZXJpY1wiLCBtb250aDogXCJzaG9ydFwiLCBkYXk6IFwibnVtZXJpY1wiIH0pXG4gICAgOiBcIi1cIjtcbiAgY29uc3QgZm9ybWF0dGVkU2l6ZSA9IGZpbGUuc2l6ZSA/IChmaWxlLnNpemUgLyAxMDI0KS50b0ZpeGVkKDEpICsgXCIgS0JcIiA6IFwiLVwiO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiBcImZsZXhcIiwgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIiwgd2lkdGg6IFwiMTAwJVwiLCBtYXJnaW5Cb3R0b206IFwiOGVtXCIsIG1hcmdpblRvcDogXCIxZW1cIiB9fT5cbiAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogXCJmbGV4XCIsIGp1c3RpZnlDb250ZW50OiBcInNwYWNlLWJldHdlZW5cIiwgYWxpZ25JdGVtczogXCJjZW50ZXJcIiwgbWFyZ2luQm90dG9tOiBcIjFyZW1cIiB9fT5cbiAgICAgICAgPGgyIHN0eWxlPXt7IGNvbG9yOiBcIiM2NjY2NjZcIiwgZm9udFNpemU6IDI0LCBtYXJnaW46IDAgfX0+e2ZpbGUuZGlzcGxheV9uYW1lIHx8IGZpbGUuZmlsZW5hbWV9PC9oMj5cbiAgICAgICAgPGJ1dHRvblxuICAgICAgICAgIG9uQ2xpY2s9e29uQmFja31cbiAgICAgICAgICBzdHlsZT17eyBiYWNrZ3JvdW5kOiBcIiMwMDg0MmNcIiwgY29sb3I6IFwiI2ZmZlwiLCBib3JkZXI6IFwibm9uZVwiLCBib3JkZXJSYWRpdXM6IFwiNHB4XCIsIHBhZGRpbmc6IFwiNnB4IDEycHhcIiwgY3Vyc29yOiBcInBvaW50ZXJcIiB9fVxuICAgICAgICA+XG4gICAgICAgICAgQmFja1xuICAgICAgICA8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdlxuICAgICAgICBzdHlsZT17e1xuICAgICAgICAgIG1hcmdpbkJvdHRvbTogXCIxLjVyZW1cIixcbiAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiI2Y5ZmFmYlwiLFxuICAgICAgICAgIHBhZGRpbmc6IFwiMXJlbVwiLFxuICAgICAgICAgIGJvcmRlclJhZGl1czogXCIwLjVyZW1cIixcbiAgICAgICAgICBib3JkZXI6IFwiMXB4IHNvbGlkICNlNWU3ZWJcIixcbiAgICAgICAgfX1cbiAgICAgID5cbiAgICAgICAgPHAgc3R5bGU9e3sgbWFyZ2luOiBcIjAuMjVyZW0gMFwiIH19PlxuICAgICAgICAgIDxzdHJvbmc+VHlwZTo8L3N0cm9uZz4ge2ZpbGVbXCJjb250ZW50LXR5cGVcIl0gfHwgZmlsZS5taW1lX2NsYXNzIHx8IFwidW5rbm93blwifVxuICAgICAgICA8L3A+XG4gICAgICAgIDxwIHN0eWxlPXt7IG1hcmdpbjogXCIwLjI1cmVtIDBcIiB9fT5cbiAgICAgICAgICA8c3Ryb25nPlNpemU6PC9zdHJvbmc+IHtmb3JtYXR0ZWRTaXplfVxuICAgICAgICA8L3A+XG4gICAgICAgIDxwIHN0eWxlPXt7IG1hcmdpbjogXCIwLjI1cmVtIDBcIiB9fT5cbiAgICAgICAgICA8c3Ryb25nPkNyZWF0ZWQ6PC9zdHJvbmc+IHtmb3JtYXR0ZWRDcmVhdGVkfVxuICAgICAgICA8L3A+XG4gICAgICAgIDxwIHN0eWxlPXt7IG1hcmdpbjogXCIwLjI1cmVtIDBcIiB9fT5cbiAgICAgICAgICA8c3Ryb25nPlVwZGF0ZWQ6PC9zdHJvbmc+IHtmb3JtYXR0ZWRVcGRhdGVkfVxuICAgICAgICA8L3A+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxMb2NhbEF0dGFjaG1lbnRWaWV3ZXIgZmlsZT17ZmlsZX0gLz5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cbiIsIi8qKlxuICogVGhlIGdyYWRlcyBwYWdlIGRpc3BsYXlzIGFsbCBvZiB0aGUgZ3JhZGVzIGZvciB0aGUgY291cnNlLiBJdCBpbmNsdWRlcyB0aGUgYWJpbGl0eSB0byBzb3J0IGJ5IGR1ZSBkYXRlLCBuYW1lLFxuICogc3VibWl0dGVkIGRhdGUsIHN0YXR1cywgYW5kIGFzc2lnbm1lbnQgZ3JvdXAuIEl0IGFsc28gaW5jbHVkZXMgdGhlIGFiaWxpdHkgdG8gZmlsdGVyIGJ5IGdyYWRpbmcgcGVyaW9kIGFuZCB0b1xuICogZ3JvdXAgYnkgYXNzaWdubWVudCBncm91cC5cbiAqIEByZXR1cm5zIHtSZWFjdC5Db21wb25lbnR9IFRoZSBncmFkZXMgcGFnZS5cbiAqL1xuZnVuY3Rpb24gR3JhZGVzUGFnZSgpIHtcbiAgY29uc3QgeyBjb3Vyc2VEYXRhIH0gPSB1c2VDb3Vyc2VDb250ZXh0KCk7XG4gIGNvbnN0IHsgdXNlU3RhdGUsIHVzZU1lbW8gfSA9IFJlYWN0O1xuICBpZiAoIWNvdXJzZURhdGEpIHtcbiAgICByZXR1cm4gPGRpdj5Mb2FkaW5nLi4uPC9kaXY+O1xuICB9XG4gIGlmICghY291cnNlRGF0YS5Bc3NpZ25tZW50cykge1xuICAgIHJldHVybiA8ZGl2Pk5vIGdyYWRlcyBhdmFpbGFibGUuPC9kaXY+O1xuICB9XG5cbiAgLy8gQ29udmVydCBkaWN0aW9uYXJ5IG9iamVjdCBvciBhcnJheSBpbnRvIGEgZmxhdCBhcnJheSBvZiBncmFkZXNcbiAgbGV0IGdyYWRlTGlzdCA9IEFycmF5LmlzQXJyYXkoY291cnNlRGF0YS5Bc3NpZ25tZW50cykgPyBjb3Vyc2VEYXRhLkFzc2lnbm1lbnRzIDogT2JqZWN0LnZhbHVlcyhjb3Vyc2VEYXRhLkFzc2lnbm1lbnRzKTtcblxuICAvLyBTZXQgdGhlIGRlZmF1bHQgc29ydGluZyBtZXRob2QgZm9yIHRoZSBncmFkZXMgcGFnZVxuICBsZXQgW3NvcnRCeSwgc2V0U29ydEJ5XSA9IHVzZVN0YXRlKFwiZHVlXCIpO1xuICAvLyBTZXQgdGhlIGRlZmF1bHQgZ3JhZGluZyBwZXJpb2QgdG8gYWxsXG4gIGxldCBbc2VsZWN0ZWRHcmFkaW5nUGVyaW9kLCBzZXRTZWxlY3RlZEdyYWRpbmdQZXJpb2RdID0gdXNlU3RhdGUoXCJhbGxcIik7XG4gIC8vIEdldCB0aGUgZ3JhZGluZyBwZXJpb2RzIGZyb20gdGhlIGNvdXJzZSBkYXRhXG4gIGxldCBncmFkaW5nUGVyaW9kcyA9IHVuZGVmaW5lZDtcbiAgaWYgKGNvdXJzZURhdGE/LkdyYWRpbmdQZXJpb2RzPy5ncmFkaW5nX3BlcmlvZHMpIHtcbiAgICBncmFkaW5nUGVyaW9kcyA9IGNvdXJzZURhdGEuR3JhZGluZ1BlcmlvZHMuZ3JhZGluZ19wZXJpb2RzO1xuICB9XG4gIC8vIEZpbHRlciBvdXQgdGhlIGFzc2lnbm1lbnRzIHRoYXQgd2lsbCBub3QgYmUgZ3JhZGVkIGdyYWRpbmdfdHlwZTogXCJub3RfZ3JhZGVkXCIsXG4gIC8vIEZpbHRlciB0aGUgYWN0aXZlIGFzc2lnbm1lbnRzIGJ5IHRoZWlyIGdyYWRpbmdfcGVyaW9kX2lkXG4gIC8vIGFuZCBzb3J0IGJ5IHRoZSBzZWxlY3RlZCBzb3J0QnkgdmFsdWVcbiAgZ3JhZGVMaXN0ID0gZ3JhZGVMaXN0XG4gICAgLmZpbHRlcihcbiAgICAgIChhc3NpZ25tZW50KSA9PlxuICAgICAgICBhc3NpZ25tZW50LmdyYWRpbmdfdHlwZSAhPT0gXCJub3RfZ3JhZGVkXCIgJiZcbiAgICAgICAgKHNlbGVjdGVkR3JhZGluZ1BlcmlvZCA9PT0gXCJhbGxcIiB8fFxuICAgICAgICAgIChhc3NpZ25tZW50Py5zdWJtaXNzaW9uPy5ncmFkaW5nX3BlcmlvZF9pZCAhPSBudWxsICYmXG4gICAgICAgICAgICBTdHJpbmcoYXNzaWdubWVudC5zdWJtaXNzaW9uLmdyYWRpbmdfcGVyaW9kX2lkKSA9PT0gU3RyaW5nKHNlbGVjdGVkR3JhZGluZ1BlcmlvZCkpKSxcbiAgICApXG4gICAgLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgIGlmIChzb3J0QnkgPT09IFwiZHVlXCIpIHtcbiAgICAgICAgY29uc3QgYURhdGUgPSBhLmR1ZV9hdCA/IG5ldyBEYXRlKGEuZHVlX2F0KSA6IG5ldyBEYXRlKDApO1xuICAgICAgICBjb25zdCBiRGF0ZSA9IGIuZHVlX2F0ID8gbmV3IERhdGUoYi5kdWVfYXQpIDogbmV3IERhdGUoMCk7XG4gICAgICAgIHJldHVybiBhRGF0ZSAtIGJEYXRlO1xuICAgICAgfSBlbHNlIGlmIChzb3J0QnkgPT09IFwibmFtZVwiKSB7XG4gICAgICAgIHJldHVybiAoYS5uYW1lIHx8IFwiXCIpLmxvY2FsZUNvbXBhcmUoYi5uYW1lIHx8IFwiXCIpO1xuICAgICAgfSBlbHNlIGlmIChzb3J0QnkgPT09IFwic3VibWl0dGVkXCIpIHtcbiAgICAgICAgY29uc3QgYVN1YiA9IGEuc3VibWlzc2lvbj8uc3VibWl0dGVkX2F0ID8gbmV3IERhdGUoYS5zdWJtaXNzaW9uLnN1Ym1pdHRlZF9hdCkgOiBuZXcgRGF0ZSgwKTtcbiAgICAgICAgY29uc3QgYlN1YiA9IGIuc3VibWlzc2lvbj8uc3VibWl0dGVkX2F0ID8gbmV3IERhdGUoYi5zdWJtaXNzaW9uLnN1Ym1pdHRlZF9hdCkgOiBuZXcgRGF0ZSgwKTtcbiAgICAgICAgcmV0dXJuIGFTdWIgLSBiU3ViO1xuICAgICAgfSBlbHNlIGlmIChzb3J0QnkgPT09IFwic3RhdHVzXCIpIHtcbiAgICAgICAgcmV0dXJuIChhLnN1Ym1pc3Npb24/LndvcmtmbG93X3N0YXRlIHx8IFwiXCIpLmxvY2FsZUNvbXBhcmUoYi5zdWJtaXNzaW9uPy53b3JrZmxvd19zdGF0ZSB8fCBcIlwiKTtcbiAgICAgIH0gZWxzZSBpZiAoc29ydEJ5ID09PSBcImFzc2lnbm1lbnRfZ3JvdXBcIikge1xuICAgICAgICByZXR1cm4gKE51bWJlcihhLmFzc2lnbm1lbnRfZ3JvdXBfaWQpIHx8IDApIC0gKE51bWJlcihiLmFzc2lnbm1lbnRfZ3JvdXBfaWQpIHx8IDApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIDA7XG4gICAgfSk7XG5cbiAgbGV0IGFzc2lnbm1lbnRHcm91cHMgPSB1bmRlZmluZWQ7XG4gIGlmIChjb3Vyc2VEYXRhPy5Bc3NpZ25tZW50R3JvdXBzKSB7XG4gICAgYXNzaWdubWVudEdyb3VwcyA9IGNvdXJzZURhdGEuQXNzaWdubWVudEdyb3VwcztcbiAgfVxuXG4gIGxldCB1c2VBc3NpZ25tZW50R3JvdXBzRm9yV2VpZ2h0aW5nID0gY291cnNlRGF0YT8ubWFuaWZlc3Q/LnVzZUFzc2lnbm1lbnRHcm91cHNGb3JXZWlnaHRpbmcgfHwgZmFsc2U7XG5cbiAgLy9Bc3NpZ25tZW50IGRldGFpbHMgb3Blbi9jbG9zZWQgc3RhdGUgbWFuYWdlbWVudC4gRGVmYXVsdCB0byBhbGwgY2xvc2VkLlxuICBjb25zdCBbb3BlblN0YXRlcywgc2V0T3BlblN0YXRlc10gPSB1c2VTdGF0ZSgoKSA9PiB7XG4gICAgY29uc3QgaW5pdGlhbCA9IHt9O1xuICAgIGdyYWRlTGlzdC5mb3JFYWNoKChtKSA9PiB7XG4gICAgICBpbml0aWFsW20uaWRdID0gdHJ1ZTtcbiAgICB9KTtcbiAgICByZXR1cm4gaW5pdGlhbDtcbiAgfSk7XG4gIC8vIERlcml2ZWQgc3RhdGU6IElmIEFUIExFQVNUIE9ORSBkZXRhaWwgaXMgb3BlbiwgYnV0dG9uIGFjdGlvbiBpcyBcIkhpZGUgQWxsIERldGFpbHNcIi5cbiAgLy8gSWYgQUxMIG1vZHVsZXMgYXJlIGNvbGxhcHNlZCAobm9uZSBhcmUgb3BlbiksIGJ1dHRvbiBhY3Rpb24gaXMgXCJTaG93IEFsbCBEZXRhaWxzXCIuXG4gIGNvbnN0IGlzQW55T3BlbiA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKG9wZW5TdGF0ZXMpLnNvbWUoKGlzT3BlbikgPT4gaXNPcGVuID09PSB0cnVlKTtcbiAgfSwgW29wZW5TdGF0ZXNdKTtcblxuICAvLyBUb2dnbGUgaW5kaXZpZHVhbCBtb2R1bGUgaGVhZGVyIGNsaWNrXG4gIGNvbnN0IGhhbmRsZVRvZ2dsZU1vZHVsZSA9IChpZCkgPT4ge1xuICAgIHNldE9wZW5TdGF0ZXMoKHByZXYpID0+ICh7XG4gICAgICAuLi5wcmV2LFxuICAgICAgW2lkXTogIXByZXZbaWRdLFxuICAgIH0pKTtcbiAgfTtcblxuICAvLyBNYXN0ZXIgYnV0dG9uIHRvZ2dsZSBoYW5kbGVyXG4gIGNvbnN0IGhhbmRsZU1hc3RlclRvZ2dsZSA9ICgpID0+IHtcbiAgICBjb25zdCBuZXh0U3RhdGUgPSAhaXNBbnlPcGVuOyAvLyBJZiBhbnkgb3BlbiAtPiBoaWRlIGFsbCBkZXRhaWxzIChmYWxzZSk7IGlmIGFsbCBjbG9zZWQgLT4gc2hvdyBhbGwgZGV0YWlscyAodHJ1ZSlcbiAgICBjb25zdCB1cGRhdGVkID0ge307XG4gICAgZ3JhZGVMaXN0LmZvckVhY2goKG0pID0+IHtcbiAgICAgIHVwZGF0ZWRbbS5pZF0gPSBuZXh0U3RhdGU7XG4gICAgfSk7XG4gICAgc2V0T3BlblN0YXRlcyh1cGRhdGVkKTtcbiAgfTtcbiAgY29uc3QgaGFuZGxlSXRlbVR5cGUgPSAoaXRlbSkgPT4ge1xuICAgIGlmICghaXRlbSB8fCAhaXRlbS50eXBlKSByZXR1cm4gXCJhc3NpZ25tZW50XCI7IC8vIERlZmF1bHQgdG8gYXNzaWdubWVudCBpZiB0eXBlIGlzIG1pc3NpbmdcbiAgICBpZiAoaXRlbT8ucXVpel9sdGkgJiYgaXRlbT8ucXVpel9sdGkgPT0gdHJ1ZSkge1xuICAgICAgcmV0dXJuIFwicXVpelwiO1xuICAgIH1cbiAgICByZXR1cm4gaXRlbS50eXBlLnRvTG93ZXJDYXNlKCk7IC8vIFJldHVybiB0aGUgdHlwZSBpbiBsb3dlcmNhc2UgZm9yIGNvbnNpc3RlbmN5XG4gIH07XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzc05hbWU9J3BhZ2UtZGl2JyBzdHlsZT17eyBtYXJnaW5Cb3R0b206IFwiNGVtXCIgfX0+XG4gICAgICA8ZGl2XG4gICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsXG4gICAgICAgICAganVzdGlmeUNvbnRlbnQ6IFwic3BhY2UtYmV0d2VlblwiLFxuICAgICAgICAgIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsXG4gICAgICAgIH19XG4gICAgICA+XG4gICAgICAgIDxoMSBzdHlsZT17eyBjb2xvcjogXCIjNjY2NjY2XCIsIGZvbnRTaXplOiAyOC44IH19PkdyYWRlczwvaDE+XG4gICAgICAgIDxidXR0b25cbiAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVNYXN0ZXJUb2dnbGV9XG4gICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogXCIjZjJmNGY0XCIsXG4gICAgICAgICAgICBib3JkZXI6IFwiMXB4IHNvbGlkICNlOGVhZWNcIixcbiAgICAgICAgICAgIHBhZGRpbmc6IFwiOHB4IDE0cHggOHB4IDE0cHhcIixcbiAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCIzcHhcIixcbiAgICAgICAgICAgIGN1cnNvcjogXCJwb2ludGVyXCIsXG4gICAgICAgICAgICBmb250U2l6ZTogXCIxNnB4XCIsXG4gICAgICAgICAgICBjb2xvcjogXCIjMjczNTQwXCIsXG4gICAgICAgICAgfX1cbiAgICAgICAgPlxuICAgICAgICAgIHshaXNBbnlPcGVuID8gXCJIaWRlIEFsbCBEZXRhaWxzXCIgOiBcIlNob3cgQWxsIERldGFpbHNcIn1cbiAgICAgICAgPC9idXR0b24+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXZcbiAgICAgICAgY2xhc3NOYW1lPSdncmFkZXMtc29ydGluZydcbiAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICBtYXJnaW5Cb3R0b206IFwiLjVlbVwiLFxuICAgICAgICAgIG1hcmdpblRvcDogXCIuNWVtXCIsXG4gICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsXG4gICAgICAgICAgZmxleERpcmVjdGlvbjogXCJyb3dcIixcbiAgICAgICAgICBqdXN0aWZ5Q29udGVudDogXCJsZWZ0XCIsXG4gICAgICAgIH19XG4gICAgICA+XG4gICAgICAgIHtncmFkaW5nUGVyaW9kcyAmJiAoXG4gICAgICAgICAgPHNwYW5cbiAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICAgICAgICBmbGV4RGlyZWN0aW9uOiBcImNvbHVtblwiLFxuICAgICAgICAgICAgICBqdXN0aWZ5Q29udGVudDogXCJsZWZ0XCIsXG4gICAgICAgICAgICAgIGdhcDogXCIwLjVlbVwiLFxuICAgICAgICAgICAgICBmb250U2l6ZTogXCIxZW1cIixcbiAgICAgICAgICAgICAgbWFyZ2luUmlnaHQ6IFwiMmVtXCIsXG4gICAgICAgICAgICB9fVxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxsYWJlbCBodG1sRm9yPSdncmFkaW5nX3BlcmlvZCc+XG4gICAgICAgICAgICAgIDxzdHJvbmc+R3JhZGluZyBQZXJpb2Q8L3N0cm9uZz5cbiAgICAgICAgICAgIDwvbGFiZWw+XG5cbiAgICAgICAgICAgIDxzZWxlY3RcbiAgICAgICAgICAgICAgbmFtZT0nZ3JhZGluZ19wZXJpb2QnXG4gICAgICAgICAgICAgIGlkPSdncmFkaW5nX3BlcmlvZCdcbiAgICAgICAgICAgICAgY2xhc3NOYW1lPSdkcm9wZG93bi1zZWxlY3QnXG4gICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gc2V0U2VsZWN0ZWRHcmFkaW5nUGVyaW9kKGUudGFyZ2V0LnZhbHVlKX1cbiAgICAgICAgICAgICAgdmFsdWU9e3NlbGVjdGVkR3JhZGluZ1BlcmlvZH1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT0nYWxsJz5BbGwgR3JhZGluZyBQZXJpb2RzPC9vcHRpb24+XG4gICAgICAgICAgICAgIHtncmFkaW5nUGVyaW9kcy5tYXAoKHBlcmlvZCkgPT4gKFxuICAgICAgICAgICAgICAgIDxvcHRpb24ga2V5PXtwZXJpb2QuaWR9IHZhbHVlPXtwZXJpb2QuaWR9PlxuICAgICAgICAgICAgICAgICAge3BlcmlvZC50aXRsZSB8fCBwZXJpb2QuZGlzcGxheV9uYW1lfVxuICAgICAgICAgICAgICAgIDwvb3B0aW9uPlxuICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgIDwvc2VsZWN0PlxuICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgKX1cbiAgICAgICAgPHNwYW5cbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsXG4gICAgICAgICAgICBmbGV4RGlyZWN0aW9uOiBcImNvbHVtblwiLFxuICAgICAgICAgICAganVzdGlmeUNvbnRlbnQ6IFwibGVmdFwiLFxuICAgICAgICAgICAgZ2FwOiBcIjAuNWVtXCIsXG4gICAgICAgICAgICBmb250U2l6ZTogXCIxZW1cIixcbiAgICAgICAgICB9fVxuICAgICAgICA+XG4gICAgICAgICAgPGxhYmVsIGh0bWxGb3I9J2dyYWRlcy1zb3J0aW5nLWRyb3Bkb3duJz5cbiAgICAgICAgICAgIDxzdHJvbmc+QXJyYW5nZSBCeTwvc3Ryb25nPlxuICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgPHNlbGVjdCBpZD0nZ3JhZGVzLXNvcnRpbmctZHJvcGRvd24nIGNsYXNzTmFtZT0nZHJvcGRvd24tc2VsZWN0JyBvbkNoYW5nZT17KGUpID0+IHNldFNvcnRCeShlLnRhcmdldC52YWx1ZSl9IHZhbHVlPXtzb3J0Qnl9PlxuICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT0nZHVlJz5EdWUgRGF0ZTwvb3B0aW9uPlxuICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT0nbmFtZSc+TmFtZTwvb3B0aW9uPlxuICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT0nc3VibWl0dGVkJz5TdWJtaXR0ZWQgRGF0ZTwvb3B0aW9uPlxuICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT0nYXNzaWdubWVudF9ncm91cCc+QXNzaWdubWVudCBHcm91cDwvb3B0aW9uPlxuICAgICAgICAgIDwvc2VsZWN0PlxuICAgICAgICA8L3NwYW4+XG4gICAgICAgIDxzcGFuXG4gICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICAgICAgZmxleEdyb3c6IDEsXG4gICAgICAgICAgICBqdXN0aWZ5Q29udGVudDogXCJyaWdodFwiLFxuICAgICAgICAgICAgbWFyZ2luUmlnaHQ6IFwiMmVtXCIsXG4gICAgICAgICAgfX1cbiAgICAgICAgPlxuICAgICAgICAgIFRvdGFsOntcIiBcIn1cbiAgICAgICAgICB7Y2FsY3VsYXRlVG90YWxXZWlnaHRlZEdyYWRlKGdyYWRlTGlzdCwgdXNlQXNzaWdubWVudEdyb3Vwc0ZvcldlaWdodGluZyA/IGFzc2lnbm1lbnRHcm91cHMgOiB1bmRlZmluZWQpXG4gICAgICAgICAgICA/IGNhbGN1bGF0ZVRvdGFsV2VpZ2h0ZWRHcmFkZShncmFkZUxpc3QsIHVzZUFzc2lnbm1lbnRHcm91cHNGb3JXZWlnaHRpbmcgPyBhc3NpZ25tZW50R3JvdXBzIDogdW5kZWZpbmVkKT8udG9GaXhlZCgyKSArIFwiJVwiXG4gICAgICAgICAgICA6IFwiTi9BXCJ9XG4gICAgICAgIDwvc3Bhbj5cbiAgICAgIDwvZGl2PlxuICAgICAgPHRhYmxlIGNsYXNzTmFtZT0nZ3JhZGVzLXRhYmxlJz5cbiAgICAgICAgPHRoZWFkPlxuICAgICAgICAgIDx0ciBjbGFzc05hbWU9J2dyYWRlcy10YWJsZS1oZWFkZXInPlxuICAgICAgICAgICAgPHRoPk5hbWU8L3RoPlxuICAgICAgICAgICAgPHRoPkR1ZTwvdGg+XG4gICAgICAgICAgICA8dGg+U3VibWl0dGVkPC90aD5cbiAgICAgICAgICAgIDx0aD5TdGF0dXM8L3RoPlxuICAgICAgICAgICAgPHRoPlNjb3JlPC90aD5cbiAgICAgICAgICAgIDx0aD48L3RoPlxuICAgICAgICAgIDwvdHI+XG4gICAgICAgIDwvdGhlYWQ+XG4gICAgICAgIDx0Ym9keSBjbGFzc05hbWU9J2dyYWRlcy10YWJsZS1ib2R5Jz5cbiAgICAgICAgICB7Z3JhZGVMaXN0Lm1hcCgoZ3JhZGUsIGluZGV4KSA9PiAoXG4gICAgICAgICAgICA8R3JhZGVUYWJsZVJvd1xuICAgICAgICAgICAgICBhc3NpZ25tZW50PXtncmFkZX1cbiAgICAgICAgICAgICAgZGV0YWlsc0hpZGRlbj17b3BlblN0YXRlc1tncmFkZS5pZF0gPz8gdHJ1ZX1cbiAgICAgICAgICAgICAgaGlkZURldGFpbENhbGxiYWNrPXsoKSA9PiBoYW5kbGVUb2dnbGVNb2R1bGUoZ3JhZGUuaWQpfVxuICAgICAgICAgICAgICBhc3NpZ25tZW50R3JvdXBzPXthc3NpZ25tZW50R3JvdXBzfVxuICAgICAgICAgICAgICBrZXk9e2luZGV4fVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICApKX1cbiAgICAgICAgICB7YXNzaWdubWVudEdyb3VwcyAmJlxuICAgICAgICAgICAgYXNzaWdubWVudEdyb3Vwcy5sZW5ndGggPiAwICYmXG4gICAgICAgICAgICBhc3NpZ25tZW50R3JvdXBzLm1hcCgoZ3JvdXAsIGluZGV4KSA9PiAoXG4gICAgICAgICAgICAgIDx0ciBjbGFzc05hbWU9J2dyYWRlLXJvdycga2V5PXtpbmRleH0+XG4gICAgICAgICAgICAgICAgPHRkIGNvbFNwYW49JzQnPlxuICAgICAgICAgICAgICAgICAgPHN0cm9uZz57Z3JvdXAubmFtZX08L3N0cm9uZz5cbiAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT17eyB0ZXh0QWxpZ246IFwiY2VudGVyXCIgfX0+XG4gICAgICAgICAgICAgICAgICA8c3Ryb25nPlxuICAgICAgICAgICAgICAgICAgICB7Y2FsY3VsYXRlR3JhZGVGb3JHcm91cChncm91cCwgZ3JhZGVMaXN0KT8ucGVyY2VudGFnZT8udG9GaXhlZCgyKVxuICAgICAgICAgICAgICAgICAgICAgID8gY2FsY3VsYXRlR3JhZGVGb3JHcm91cChncm91cCwgZ3JhZGVMaXN0KT8ucGVyY2VudGFnZT8udG9GaXhlZCgyKSArIFwiJVwiXG4gICAgICAgICAgICAgICAgICAgICAgOiBcIk4vQVwifVxuICAgICAgICAgICAgICAgICAgPC9zdHJvbmc+XG4gICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICA8dGQgc3R5bGU9e3sgdGV4dEFsaWduOiBcInJpZ2h0XCIgfX0+XG4gICAgICAgICAgICAgICAgICA8c3Ryb25nIHN0eWxlPXt7IHdoaXRlU3BhY2U6IFwibm93cmFwXCIgfX0+XG4gICAgICAgICAgICAgICAgICAgIHtjYWxjdWxhdGVHcmFkZUZvckdyb3VwKGdyb3VwLCBncmFkZUxpc3QpPy50b3RhbFBvaW50c0Vhcm5lZD8udG9GaXhlZCgyKSB8fCBcIk4vQVwifSAve1wiIFwifVxuICAgICAgICAgICAgICAgICAgICB7Y2FsY3VsYXRlR3JhZGVGb3JHcm91cChncm91cCwgZ3JhZGVMaXN0KT8udG90YWxQb2ludHNQb3NzaWJsZT8udG9GaXhlZCgyKSB8fCBcIk4vQVwifVxuICAgICAgICAgICAgICAgICAgPC9zdHJvbmc+XG4gICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICkpfVxuICAgICAgICAgIDx0ciBjbGFzc05hbWU9J2dyYWRlLXJvdyBncmFkZS1yb3ctdG90YWwnPlxuICAgICAgICAgICAgPHRkIGNvbFNwYW49JzQnIHN0eWxlPXt7IHRleHRBbGlnbjogXCJsZWZ0XCIsIHRleHRXcmFwOiBcIm5vd3JhcFwiIH19PlxuICAgICAgICAgICAgICA8c3Ryb25nPlRvdGFsPC9zdHJvbmc+XG4gICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgPHRkIHN0eWxlPXt7IHRleHRBbGlnbjogXCJjZW50ZXJcIiB9fT5cbiAgICAgICAgICAgICAgPHN0cm9uZz5cbiAgICAgICAgICAgICAgICB7Y2FsY3VsYXRlVG90YWxXZWlnaHRlZEdyYWRlKGdyYWRlTGlzdCwgdXNlQXNzaWdubWVudEdyb3Vwc0ZvcldlaWdodGluZyA/IGFzc2lnbm1lbnRHcm91cHMgOiB1bmRlZmluZWQpXG4gICAgICAgICAgICAgICAgICA/IGNhbGN1bGF0ZVRvdGFsV2VpZ2h0ZWRHcmFkZShncmFkZUxpc3QsIHVzZUFzc2lnbm1lbnRHcm91cHNGb3JXZWlnaHRpbmcgPyBhc3NpZ25tZW50R3JvdXBzIDogdW5kZWZpbmVkKT8udG9GaXhlZCgyKSArIFwiJVwiXG4gICAgICAgICAgICAgICAgICA6IFwiTi9BXCJ9XG4gICAgICAgICAgICAgIDwvc3Ryb25nPlxuICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgIDx0ZCBzdHlsZT17eyB0ZXh0QWxpZ246IFwiY2VudGVyXCIgfX0+XG4gICAgICAgICAgICAgIDxzdHJvbmc+XG4gICAgICAgICAgICAgICAge2NhbGN1bGF0ZVRvdGFsUG9pbnRzKGdyYWRlTGlzdCk/LnRvdGFsUG9pbnRzRWFybmVkPy50b0ZpeGVkKDIpIHx8IFwiTi9BXCJ9IC97XCIgXCJ9XG4gICAgICAgICAgICAgICAge2NhbGN1bGF0ZVRvdGFsUG9pbnRzKGdyYWRlTGlzdCk/LnRvdGFsUG9pbnRzUG9zc2libGU/LnRvRml4ZWQoMikgfHwgXCJOL0FcIn1cbiAgICAgICAgICAgICAgPC9zdHJvbmc+XG4gICAgICAgICAgICA8L3RkPlxuICAgICAgICAgIDwvdHI+XG4gICAgICAgIDwvdGJvZHk+XG4gICAgICA8L3RhYmxlPlxuICAgICAgPGRpdiBjbGFzc05hbWU9J2dyb3VwLXdlaWdodGluZyc+XG4gICAgICAgIHshdXNlQXNzaWdubWVudEdyb3Vwc0ZvcldlaWdodGluZyB8fCAhYXNzaWdubWVudEdyb3VwcyB8fCBhc3NpZ25tZW50R3JvdXBzLmxlbmd0aCA9PT0gMCA/IChcbiAgICAgICAgICA8cCBjbGFzc05hbWU9J25vLXdlaWdodGluZy10ZXh0Jz5Db3Vyc2UgYXNzaWdubWVudHMgYXJlIG5vdCB3ZWlnaHRlZC48L3A+XG4gICAgICAgICkgOiAoXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9J3dlaWdodGluZy1jb250YWluZXInPlxuICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT0nd2VpZ2h0aW5nLXRpdGxlJz5Db3Vyc2UgV2VpZ2h0aW5nPC9oMz5cbiAgICAgICAgICAgIDx0YWJsZSBjbGFzc05hbWU9J3dlaWdodGluZy10YWJsZSc+XG4gICAgICAgICAgICAgIDx0aGVhZD5cbiAgICAgICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgICA8dGg+R3JvdXA8L3RoPlxuICAgICAgICAgICAgICAgICAgPHRoPldlaWdodDwvdGg+XG4gICAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICAgPC90aGVhZD5cbiAgICAgICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAgICAgIHthc3NpZ25tZW50R3JvdXBzLm1hcCgoZ3JvdXAsIGluZGV4KSA9PiAoXG4gICAgICAgICAgICAgICAgICA8dHIga2V5PXtncm91cC5pZCB8fCBpbmRleH0+XG4gICAgICAgICAgICAgICAgICAgIDx0ZD57Z3JvdXAubmFtZX08L3RkPlxuICAgICAgICAgICAgICAgICAgICA8dGQ+e2dyb3VwLmdyb3VwX3dlaWdodCAhPT0gdW5kZWZpbmVkICYmIGdyb3VwLmdyb3VwX3dlaWdodCAhPT0gbnVsbCA/IGAke2dyb3VwLmdyb3VwX3dlaWdodH0lYCA6IFwiTi9BXCJ9PC90ZD5cbiAgICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgIDwvdGJvZHk+XG4gICAgICAgICAgICA8L3RhYmxlPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICApfVxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59XG4vKipcbiAqIFJlbmRlcnMgYSBzaW5nbGUgdGFibGUgcm93IGZvciB0aGUgZ3JhZGUgdGFibGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wc1xuICogQHBhcmFtIHtPYmplY3R9IHByb3BzLmFzc2lnbm1lbnQgLSBUaGUgYXNzaWdubWVudCB0byByZW5kZXJcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gcHJvcHMuZGV0YWlsc0hpZGRlbiAtIFdoZXRoZXIgdGhlIGRldGFpbHMgYXJlIGhpZGRlblxuICogQHBhcmFtIHtGdW5jdGlvbn0gcHJvcHMuaGlkZURldGFpbENhbGxiYWNrIC0gVGhlIGNhbGxiYWNrIHRvIGhpZGUgdGhlIGRldGFpbHNcbiAqIEBwYXJhbSB7QXJyYXk8T2JqZWN0Pn0gcHJvcHMuYXNzaWdubWVudEdyb3VwcyAtIFRoZSBhc3NpZ25tZW50IGdyb3Vwc1xuICogQHJldHVybnMgYSBzaW5nbGUgdGFibGUgcm93IGZvciB0aGUgZ3JhZGUgdGFibGVcbiAqL1xuZnVuY3Rpb24gR3JhZGVUYWJsZVJvdyh7IGFzc2lnbm1lbnQsIGRldGFpbHNIaWRkZW4sIGhpZGVEZXRhaWxDYWxsYmFjaywgYXNzaWdubWVudEdyb3VwcyB9KSB7XG4gIGNvbnN0IHsgbmF2aWdhdGVUb0Fzc2lnbm1lbnQgfSA9IHVzZU5hdmlnYXRpb24oKTtcbiAgY29uc3QgeyByZWNvbm5lY3RGb2xkZXIgfSA9IHVzZUNvdXJzZUNvbnRleHQoKTtcblxuICBsZXQgYXNzaWdubWVudEdyb3VwTmFtZSA9IFwiVW5rbm93biBBc3NpZ25tZW50IEdyb3VwXCI7XG4gIGlmIChhc3NpZ25tZW50R3JvdXBzICYmIGFzc2lnbm1lbnRHcm91cHMubGVuZ3RoID4gMCkge1xuICAgIC8vIHRha2VzIGEgbGlzdCBvZiBhc3NpZ25tZW50IGdyb3VwcyBhbmQgZmluZHMgdGhlIG5hbWUgb2YgdGhlIGdyb3VwIHRoYXQgbWF0Y2hlcyB0aGUgYXNzaWdubWVudCdzIGdyb3VwIElEXG4gICAgYXNzaWdubWVudEdyb3VwTmFtZSA9XG4gICAgICBhc3NpZ25tZW50R3JvdXBzLmZpbHRlcigoZ3JvdXApID0+IGdyb3VwLmlkID09PSBhc3NpZ25tZW50LmFzc2lnbm1lbnRfZ3JvdXBfaWQpWzBdPy5uYW1lIHx8IFwiVW5rbm93biBBc3NpZ25tZW50IEdyb3VwXCI7XG4gIH1cbiAgbGV0IGNoZWNrbWFyayA9IChcbiAgICA8c3ZnIHZpZXdCb3g9JzAgMCAxOTIwIDE5MjAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zycgc3R5bGU9e3sgaGVpZ2h0OiBcIjE2cHhcIiwgd2lkdGg6IFwiMTZweFwiIH19PlxuICAgICAgPHBhdGggZD0nTTE4MjcuNzAxIDMwMy4wNjUgNjk4LjgzNSAxNDMxLjgwMSA5Mi4yOTkgODI1LjI2NiAwIDkxNy41NjQgNjk4LjgzNSAxNjE2LjQgMTkxOS44NjkgMzk1LjIzNHonIC8+XG4gICAgPC9zdmc+XG4gICk7XG4gIGxldCB4bWFyayA9IChcbiAgICA8c3ZnIHZpZXdCb3g9JzAgMCAxOTIwIDE5MjAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zycgc3R5bGU9e3sgaGVpZ2h0OiBcIjE2cHhcIiwgd2lkdGg6IFwiMTZweFwiIH19PlxuICAgICAgPHBhdGggZD0nTTk1NC42NCA4MjYuNDE4IDQyNi42NjcgMjk4LjQ0NSAyOTguNDQ1IDQyNi42NjcgODI2LjQxOCA5NTQuNjRsLTUyNy45NzMgNTI3Ljk3MyAxMjguMjIyIDEyOC4yMjIgNTI3Ljk3My01MjcuOTczIDUyNy45NzMgNTI3Ljk3MyAxMjguMjIyLTEyOC4yMjItNTI3Ljk3My01MjcuOTczIDUyNy45NzMtNTI3Ljk3My0xMjguMjIyLTEyOC4yMjJ6JyAvPlxuICAgIDwvc3ZnPlxuICApO1xuICBjb25zdCByZW5kZXJHcmFkZSA9IChhc3NpZ25tZW50KSA9PiB7XG4gICAgY29uc3QgeyBncmFkaW5nX3R5cGUsIHBvaW50c19wb3NzaWJsZSwgc3VibWlzc2lvbiB9ID0gYXNzaWdubWVudCB8fCB7fTtcblxuICAgIGlmIChncmFkaW5nX3R5cGUgPT09IFwicG9pbnRzXCIpIHtcbiAgICAgIHJldHVybiBgJHtzdWJtaXNzaW9uPy5zY29yZSA/PyBcIi1cIn0gLyAke3BvaW50c19wb3NzaWJsZSA/PyBcIi1cIn1gO1xuICAgIH1cblxuICAgIGlmIChncmFkaW5nX3R5cGUgPT09IFwicGFzc19mYWlsXCIpIHtcbiAgICAgIHJldHVybiBzdWJtaXNzaW9uPy5ncmFkZSA9PT0gXCJjb21wbGV0ZVwiID8gY2hlY2ttYXJrIDogeG1hcms7XG4gICAgfVxuXG4gICAgaWYgKGdyYWRpbmdfdHlwZSA9PT0gXCJub3RfZ3JhZGVkXCIpIHtcbiAgICAgIHJldHVybiBcIi1cIjtcbiAgICB9XG4gICAgaWYgKGdyYWRpbmdfdHlwZSA9PSBcImxldHRlcl9ncmFkZVwiKSB7XG4gICAgICByZXR1cm4gYCR7c3VibWlzc2lvbj8uc2NvcmV9ICgke3N1Ym1pc3Npb24/LmdyYWRlfSlgO1xuICAgIH1cblxuICAgIHJldHVybiBcIi1cIjtcbiAgfTtcblxuICByZXR1cm4gKFxuICAgIDw+XG4gICAgICA8dHIgY2xhc3NOYW1lPSdncmFkZS1yb3cnIGtleT17YXNzaWdubWVudC5pZH0+XG4gICAgICAgIDx0ZCBzdHlsZT17eyBtYXhXaWR0aDogXCIzMCVcIiB9fT5cbiAgICAgICAgICA8YVxuICAgICAgICAgICAgaHJlZj0nIydcbiAgICAgICAgICAgIGNsYXNzTmFtZT0nYXNzaWdubWVudC1saW5rJ1xuICAgICAgICAgICAgb25DbGljaz17KCkgPT4ge1xuICAgICAgICAgICAgICByZWNvbm5lY3RGb2xkZXIoKTtcbiAgICAgICAgICAgICAgbmF2aWdhdGVUb0Fzc2lnbm1lbnQoYXNzaWdubWVudD8uaWQpO1xuICAgICAgICAgICAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICB7YXNzaWdubWVudC5uYW1lfVxuICAgICAgICAgIDwvYT5cbiAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGZvbnRTaXplOiBcIjE0cHhcIiwgY29sb3I6IFwicmdiKDM5LCA1MywgNjQpXCIgfX0+e2Fzc2lnbm1lbnRHcm91cE5hbWV9PC9kaXY+XG4gICAgICAgIDwvdGQ+XG4gICAgICAgIDx0ZD57YXNzaWdubWVudC5kdWVfYXQgPyBmaXhEYXRlRm9ybWF0KGFzc2lnbm1lbnQuZHVlX2F0KSA6IFwiXCJ9PC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPXt7IHRleHRBbGlnbjogXCJsZWZ0XCIgfX0+XG4gICAgICAgICAge2Fzc2lnbm1lbnQuc3VibWlzc2lvbj8uc3VibWl0dGVkX2F0ID8gZml4RGF0ZUZvcm1hdChhc3NpZ25tZW50LnN1Ym1pc3Npb24/LnN1Ym1pdHRlZF9hdCkgOiBcIlwifVxuICAgICAgICA8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9e3sgdGV4dEFsaWduOiBcImNlbnRlclwiIH19PlxuICAgICAgICAgIHthc3NpZ25tZW50LnN1Ym1pc3Npb24/LmxhdGUgJiYgIWFzc2lnbm1lbnQuc3VibWlzc2lvbj8ubWlzc2luZyAmJiA8Q29udGV4dFBpbGwgdHlwZT0nbGF0ZScgLz59XG4gICAgICAgICAge2Fzc2lnbm1lbnQuc3VibWlzc2lvbj8ubWlzc2luZyAmJiA8Q29udGV4dFBpbGwgdHlwZT0nbWlzc2luZycgLz59XG4gICAgICAgIDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT17eyB0ZXh0QWxpZ246IFwiY2VudGVyXCIsIHdoaXRlU3BhY2U6IFwibm93cmFwXCIgfX0+e3JlbmRlckdyYWRlKGFzc2lnbm1lbnQpfTwvdGQ+XG4gICAgICAgIDx0ZD5cbiAgICAgICAgICB7LypBZGQgZGV0YWlscyBidXR0b24sIGNvdW50IHR3b2FyZHMgZmluYWwgZ3JhZGUsIGFuZCAoY29tbWVudHMpPyovfVxuICAgICAgICAgIHshYXNzaWdubWVudD8uc2NvcmVfc3RhdGlzdGljcyA/IG51bGwgOiAoXG4gICAgICAgICAgICA8c3ZnXG4gICAgICAgICAgICAgIHZpZXdCb3g9JzAgMCAxOTIwIDE5MjAnXG4gICAgICAgICAgICAgIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZydcbiAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICB3aWR0aDogXCIxNnB4XCIsXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiBcIjE2cHhcIixcbiAgICAgICAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICAgICAgICBqdXN0aWZ5Q29udGVudDogXCJjZW50ZXJcIixcbiAgICAgICAgICAgICAgICBhbGlnbkl0ZW1zOiBcImNlbnRlclwiLFxuICAgICAgICAgICAgICAgIGN1cnNvcjogXCJwb2ludGVyXCIsXG4gICAgICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcIiNmMmY0ZjRcIixcbiAgICAgICAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiNHB4XCIsXG4gICAgICAgICAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCAjZThlYWVjXCIsXG4gICAgICAgICAgICAgICAgY29sb3I6IFwicmdiKDk5LCAxMDksIDExNylcIixcbiAgICAgICAgICAgICAgICBwYWRkaW5nOiBcIi41ZW1cIixcbiAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgb25DbGljaz17aGlkZURldGFpbENhbGxiYWNrfVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICA8cGF0aFxuICAgICAgICAgICAgICAgIGQ9J00xNzA5LjI4OSA5NTkuNjczdjg1NC42MDRIMzQxLjgwOHYtNzk3Ljc0NGgxMTMuOTQ3djY4My43OTdIMTU5NS4zNFY5NTkuNjczaDExMy45NDhaTTE4NDAuMzUgNDM0LjU3bDc5LjY1IDgxLjU4Ni03OTcuNjMgNzc5LjYyNy0zNjQuNTE4LTM1Ni41NCA3OS42NDktODEuMzYgMjg0Ljg2OCAyNzguNDg4IDcxNy45ODItNzAxLjgwMVpNNDU1Ljc4OSAxMDV2MzQxLjk1NmgzNDEuOTU2djExMy45NDdINDU1Ljc4OXYzNDEuNzI4SDM0MS44NDJWNTYwLjkwM0gwVjQ0Ni45NTZoMzQxLjg0MlYxMDVoMTEzLjk0N1ptMTA4Mi41MzMgMzQxLjg3NnYxMTMuOTQ3aC02MjYuNzFWNDQ2Ljg3Nmg2MjYuNzFaJ1xuICAgICAgICAgICAgICAgIGZpbGwtcnVsZT0nZXZlbm9kZCdcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvc3ZnPlxuICAgICAgICAgICl9XG4gICAgICAgICAgeyFhc3NpZ25tZW50Py5vbWl0X2Zyb21fZmluYWxfZ3JhZGUgPyBudWxsIDogKFxuICAgICAgICAgICAgPHN2Z1xuICAgICAgICAgICAgICB2aWV3Qm94PScwIDAgMTkyMCAxOTIwJ1xuICAgICAgICAgICAgICB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnXG4gICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgd2lkdGg6IFwiMTZweFwiLFxuICAgICAgICAgICAgICAgIGhlaWdodDogXCIxNnB4XCIsXG4gICAgICAgICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsXG4gICAgICAgICAgICAgICAganVzdGlmeUNvbnRlbnQ6IFwiY2VudGVyXCIsXG4gICAgICAgICAgICAgICAgYWxpZ25JdGVtczogXCJjZW50ZXJcIixcbiAgICAgICAgICAgICAgICBjdXJzb3I6IFwicG9pbnRlclwiLFxuICAgICAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogXCIjZjJmNGY0XCIsXG4gICAgICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiBcIjRweFwiLFxuICAgICAgICAgICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgI2U4ZWFlY1wiLFxuICAgICAgICAgICAgICAgIGNvbG9yOiBcInJnYig5OSwgMTA5LCAxMTcpXCIsXG4gICAgICAgICAgICAgICAgcGFkZGluZzogXCIuNWVtXCIsXG4gICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgIG9uQ2xpY2s9e2hpZGVEZXRhaWxDYWxsYmFja31cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPHBhdGhcbiAgICAgICAgICAgICAgICBkPSdNOTYwIDBjNTMwLjE5MyAwIDk2MCA0MjkuODA3IDk2MCA5NjBzLTQyOS44MDcgOTYwLTk2MCA5NjBTMCAxNDkwLjE5MyAwIDk2MCA0MjkuODA3IDAgOTYwIDBabTAgMTAxLjA1M2MtNDc0LjM4NCAwLTg1OC45NDcgMzg0LjU2My04NTguOTQ3IDg1OC45NDdTNDg1LjYxNiAxODE4Ljk0NyA5NjAgMTgxOC45NDcgMTgxOC45NDcgMTQzNC4zODQgMTgxOC45NDcgOTYwIDE0MzQuMzg0IDEwMS4wNTMgOTYwIDEwMS4wNTNabS05LjMyIDEyMjEuNDljLTgwLjAyNCAwLTE0NS4xMjggNjUuMTA1LTE0NS4xMjggMTQ1LjEyOSAwIDgwLjAyNCA2NS4xMDQgMTQ1LjEyOCAxNDUuMTI4IDE0NS4xMjggODAuMDI0IDAgMTQ1LjEyOC02NS4xMDQgMTQ1LjEyOC0xNDUuMTI4IDAtODAuMDI0LTY1LjEwNC0xNDUuMTI4LTE0NS4xMjgtMTQ1LjEyOFptMTkyLjc4NS05NjguODU5aC0zODUuNTdsOTMuOTAxIDg1MS4zMjdoMTk3Ljc2OGw5My45MDEtODUxLjMyN1onXG4gICAgICAgICAgICAgICAgZmlsbC1ydWxlPSdldmVub2RkJ1xuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC90ZD5cbiAgICAgIDwvdHI+XG4gICAgICA8dHJcbiAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICBkaXNwbGF5OiBkZXRhaWxzSGlkZGVuIHx8ICFhc3NpZ25tZW50Py5vbWl0X2Zyb21fZmluYWxfZ3JhZGUgPyBcIm5vbmVcIiA6IFwidGFibGUtcm93XCIsXG4gICAgICAgIH19XG4gICAgICAgIGNsYXNzTmFtZT0nZ3JhZGUtcm93LWRldGFpbHMnXG4gICAgICAgIGtleT17YCR7YXNzaWdubWVudC5pZH0tZGV0YWlsc2B9XG4gICAgICA+XG4gICAgICAgIDx0ZCBjb2xTcGFuPSc2JyBzdHlsZT17eyBwYWRkaW5nOiBcIjAuNWVtIDFlbVwiIH19PlxuICAgICAgICAgIDxzdHJvbmc+VGhpcyBBc3NpZ25tZW50IGRvZXMgbm90IGNvdW50IHR3b2FyZHMgdGhlIGZpbmFsIGdyYWRlLjwvc3Ryb25nPlxuICAgICAgICA8L3RkPlxuICAgICAgPC90cj5cbiAgICAgIDx0clxuICAgICAgICBzdHlsZT17e1xuICAgICAgICAgIGRpc3BsYXk6IGRldGFpbHNIaWRkZW4gfHwgIWFzc2lnbm1lbnQ/LnNjb3JlX3N0YXRpc3RpY3MgPyBcIm5vbmVcIiA6IFwidGFibGUtcm93XCIsXG4gICAgICAgIH19XG4gICAgICAgIGNsYXNzTmFtZT0nZ3JhZGUtcm93LWRldGFpbHMnXG4gICAgICAgIGtleT17YCR7YXNzaWdubWVudC5pZH0tZGV0YWlsc2B9XG4gICAgICA+XG4gICAgICAgIDx0ZCBjb2xTcGFuPSc2JyBzdHlsZT17eyBwYWRkaW5nOiBcIjAuNWVtIDFlbVwiIH19PlxuICAgICAgICAgIDx0YWJsZVxuICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgbWF4V2lkdGg6IFwiOTAlXCIsXG4gICAgICAgICAgICAgIG1pbldpZHRoOiBcIjgwJVwiLFxuICAgICAgICAgICAgICBib3JkZXJDb2xsYXBzZTogXCJjb2xsYXBzZVwiLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICA8dGhlYWQgc3R5bGU9e3sgYm9yZGVyQm90dG9tOiBcIjFweCBzb2xpZCAjY2NjXCIgfX0+XG4gICAgICAgICAgICAgIDx0clxuICAgICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgICB3aWR0aDogXCIxMDAlXCIsXG4gICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDx0aCBjb2xTcGFuPSczJyBzdHlsZT17eyB0ZXh0QWxpZ246IFwibGVmdFwiIH19PlxuICAgICAgICAgICAgICAgICAgU2NvcmUgRGV0YWlsc1xuICAgICAgICAgICAgICAgIDwvdGg+XG4gICAgICAgICAgICAgICAgPHRoIHN0eWxlPXt7IHRleHRBbGlnbjogXCJyaWdodFwiLCBwYWRkaW5nUmlnaHQ6IFwiMWVtXCIgfX0+XG4gICAgICAgICAgICAgICAgICA8YSBvbkNsaWNrPXtoaWRlRGV0YWlsQ2FsbGJhY2t9IGNsYXNzTmFtZT0nYXNzaWdubWVudC1saW5rJyBzdHlsZT17eyBmbG9hdDogXCJyaWdodFwiLCBmb250V2VpZ2h0OiBcIm5vcm1hbFwiIH19PlxuICAgICAgICAgICAgICAgICAgICBDbG9zZVxuICAgICAgICAgICAgICAgICAgPC9hPlxuICAgICAgICAgICAgICAgIDwvdGg+XG4gICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICA8L3RoZWFkPlxuICAgICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAgICA8dHIgY2xhc3NOYW1lPSdncmFkZS1yb3cnIHN0eWxlPXt7IGZvbnRTaXplOiBcIjE0cHhcIiwgY29sb3I6IFwicmdiKDM5LCA1MywgNjQpXCIgfX0+XG4gICAgICAgICAgICAgICAgPHRkPlxuICAgICAgICAgICAgICAgICAgTWVhbjoge2Fzc2lnbm1lbnQ/LnNjb3JlX3N0YXRpc3RpY3M/Lm1lYW4gfHwgXCItXCJ9IDxiciAvPiBNZWRpYW46IHthc3NpZ25tZW50Py5zY29yZV9zdGF0aXN0aWNzPy5tZWRpYW4gfHwgXCItXCJ9e1wiIFwifVxuICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgPHRkPlxuICAgICAgICAgICAgICAgICAgSGlnaDoge2Fzc2lnbm1lbnQ/LnNjb3JlX3N0YXRpc3RpY3M/Lm1heCB8fCBcIi1cIn0gPGJyIC8+IFVwcGVyIFF1YXJ0aWxlOiB7YXNzaWdubWVudD8uc2NvcmVfc3RhdGlzdGljcz8ubWVkaWFuIHx8IFwiLVwifXtcIiBcIn1cbiAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgIDx0ZD5cbiAgICAgICAgICAgICAgICAgIExvdzoge2Fzc2lnbm1lbnQ/LnNjb3JlX3N0YXRpc3RpY3M/Lm1pbiB8fCBcIjBcIn0gPGJyIC8+IExvd2VyIFF1YXJ0aWxlOiB7YXNzaWdubWVudD8uc2NvcmVfc3RhdGlzdGljcz8ubWVkaWFuIHx8IFwiLVwifXtcIiBcIn1cbiAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgIDx0ZD5cbiAgICAgICAgICAgICAgICAgIDxTY29yZURpc3RyaWJ1dGlvbkdyYXBoIGFzc2lnbm1lbnQ9e2Fzc2lnbm1lbnR9IC8+XG4gICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgIDwvdGJvZHk+XG4gICAgICAgICAgPC90YWJsZT5cbiAgICAgICAgPC90ZD5cbiAgICAgIDwvdHI+XG4gICAgPC8+XG4gICk7XG59XG4iLCIvKipcbiAqIEhvbWUgUGFnZSBjb21wb25lbnQgdGhhdCBkaXNwbGF5cyB0aGUgaG9tZSBwYWdlIGNvbnRlbnQuIEl0IGNoZWNrcyBpZiB0aGUgY291cnNlRGF0YSBpcyBhdmFpbGFibGUgYW5kIHJlbmRlcnMgdGhlIGFwcHJvcHJpYXRlIGNvbnRlbnQuXG4gKi9cbmZ1bmN0aW9uIEhvbWVQYWdlKCkge1xuICBjb25zdCB7IGNvdXJzZURhdGEgfSA9IHVzZUNvdXJzZUNvbnRleHQoKTtcbiAgaWYgKCFjb3Vyc2VEYXRhKSB7XG4gICAgcmV0dXJuIDxkaXY+TG9hZGluZy4uLjwvZGl2PjtcbiAgfVxuICBpZiAoIWNvdXJzZURhdGEuRnJvbnRQYWdlKSB7XG4gICAgcmV0dXJuIDxkaXY+Tm8gY291cnNlIGhvbWUgcGFnZSBhdmFpbGFibGUuPC9kaXY+O1xuICB9IGVsc2UgaWYgKGNvdXJzZURhdGEuRnJvbnRQYWdlKSB7XG4gICAgcmV0dXJuIGNvdXJzZURhdGEuRnJvbnRQYWdlLmJvZHkgPyAoXG4gICAgICA8ZGl2IGNsYXNzTmFtZT0ncGFnZS1kaXYnPlxuICAgICAgICA8aDEgc3R5bGU9e3sgY29sb3I6IFwiIzY2NjY2NlwiLCBmb250U2l6ZTogMjguOCB9fT57Y291cnNlRGF0YS5tYW5pZmVzdC5jb3Vyc2V9PC9oMT5cbiAgICAgICAgPGRpdiBpZD0naG9tZS1wYWdlLWNvbnRlbnQnIGRhbmdlcm91c2x5U2V0SW5uZXJIVE1MPXt7IF9faHRtbDogY291cnNlRGF0YS5Gcm9udFBhZ2UuYm9keSB9fSAvPlxuICAgICAgPC9kaXY+XG4gICAgKSA6IChcbiAgICAgIDxkaXY+Tm8gY29udGVudCBhdmFpbGFibGUgZm9yIHRoZSBjb3Vyc2UgaG9tZSBwYWdlLjwvZGl2PlxuICAgICk7XG4gIH1cbn1cbiIsImZ1bmN0aW9uIE1haW5Db250ZW50KCkge1xuICAgICAgY29uc3QgW3Nob3dDb3Vyc2VMaXN0LCBzZXRTaG93Q291cnNlTGlzdF0gPSB1c2VTdGF0ZSh0cnVlKTtcbiAgICAgIGNvbnN0IHsgYWN0aXZlS2V5LCBzZWxlY3RlZEFzc2lnbm1lbnRJZCwgc2VsZWN0ZWRQYWdlVXJsLCBzZWxlY3RlZERpc2N1c3Npb25JZCwgc2VsZWN0ZWRBbm5vdW5jZW1lbnRJZCwgbmF2aWdhdGVUb1NlY3Rpb24gfSA9XG4gICAgICAgIHVzZU5hdmlnYXRpb24oKTtcblxuICAgICAgY29uc3QgeyBjb3Vyc2VEYXRhIH0gPSB1c2VDb3Vyc2VDb250ZXh0KCk7XG5cbiAgICAgIGNvbnN0IGVsZW1lbnRzID0gUmVhY3QudXNlTWVtbygoKSA9PiB7XG4gICAgICAgIGlmICghY291cnNlRGF0YSkgcmV0dXJuIFtdO1xuICAgICAgICBjb25zb2xlLmxvZyhcIkNvdXJzZSBkYXRhOlwiLCBjb3Vyc2VEYXRhKTtcbiAgICAgICAgY29uc3QgbGlzdCA9IFtdO1xuICAgICAgICBpZiAoY291cnNlRGF0YS5Gcm9udFBhZ2UpIHtcbiAgICAgICAgICBsaXN0LnB1c2goeyBrZXk6IFwiZnJvbnRwYWdlXCIsIHRpdGxlOiBcIkhvbWVcIiB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY291cnNlRGF0YS5Bc3NpZ25tZW50cykge1xuICAgICAgICAgIGxpc3QucHVzaCh7IGtleTogXCJhc3NpZ25tZW50c1wiLCB0aXRsZTogXCJBc3NpZ25tZW50c1wiIH0pO1xuICAgICAgICAgIGxpc3QucHVzaCh7IGtleTogXCJncmFkZXNcIiwgdGl0bGU6IFwiR3JhZGVzXCIgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvdXJzZURhdGEuTW9kdWxlcykge1xuICAgICAgICAgIGxpc3QucHVzaCh7IGtleTogXCJtb2R1bGVzXCIsIHRpdGxlOiBcIk1vZHVsZXNcIiB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY291cnNlRGF0YS5EaXNjdXNzaW9ucyAmJiBPYmplY3Qua2V5cyhjb3Vyc2VEYXRhLkRpc2N1c3Npb25zIHx8IHt9KS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgbGlzdC5wdXNoKHsga2V5OiBcImRpc2N1c3Npb25zXCIsIHRpdGxlOiBcIkRpc2N1c3Npb25zXCIgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvdXJzZURhdGEuRmlsZXMgJiYgKGNvdXJzZURhdGEuRmlsZXM/LmZpbGVzPy5sZW5ndGggPiAwIHx8IGNvdXJzZURhdGEuRmlsZXM/LmZvbGRlcnM/Lmxlbmd0aCA+IDEpKSB7XG4gICAgICAgICAgbGlzdC5wdXNoKHsga2V5OiBcImZpbGVzXCIsIHRpdGxlOiBcIkZpbGVzXCIgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvdXJzZURhdGEuUGFnZXMpIHtcbiAgICAgICAgICBsaXN0LnB1c2goeyBrZXk6IFwicGFnZXNcIiwgdGl0bGU6IFwiUGFnZXNcIiB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY291cnNlRGF0YS5Bbm5vdW5jZW1lbnRzKSB7XG4gICAgICAgICAgbGlzdC5wdXNoKHsga2V5OiBcImFubm91bmNlbWVudHNcIiwgdGl0bGU6IFwiQW5ub3VuY2VtZW50c1wiIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBsaXN0O1xuICAgICAgfSwgW2NvdXJzZURhdGFdKTtcblxuICAgICAgLy8gU2V0IGluaXRpYWwgYWN0aXZlIGtleSBzYWZlbHkgaW4gdXNlRWZmZWN0IHdoZW4gY291cnNlIGRhdGEgbG9hZHNcbiAgICAgIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgICAgIGlmIChjb3Vyc2VEYXRhICYmICFhY3RpdmVLZXkpIHtcbiAgICAgICAgICBpZiAoY291cnNlRGF0YS5Gcm9udFBhZ2UpIHtcbiAgICAgICAgICAgIG5hdmlnYXRlVG9TZWN0aW9uKFwiZnJvbnRwYWdlXCIpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZWxlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbmF2aWdhdGVUb1NlY3Rpb24oZWxlbWVudHNbMF0ua2V5KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sIFtjb3Vyc2VEYXRhLCBlbGVtZW50cywgYWN0aXZlS2V5XSk7XG5cbiAgICAgIC8vIEZpbmQgc2VsZWN0ZWQgYXNzaWdubWVudCBvYmplY3QgaWYgdmlld2luZyBvbmVcbiAgICAgIGNvbnN0IGN1cnJlbnRBc3NpZ25tZW50ID0gUmVhY3QudXNlTWVtbygoKSA9PiB7XG4gICAgICAgIGlmICghc2VsZWN0ZWRBc3NpZ25tZW50SWQgfHwgIWNvdXJzZURhdGE/LkFzc2lnbm1lbnRzKSByZXR1cm4gbnVsbDtcbiAgICAgICAgY29uc3QgbGlzdCA9IEFycmF5LmlzQXJyYXkoY291cnNlRGF0YS5Bc3NpZ25tZW50cykgPyBjb3Vyc2VEYXRhLkFzc2lnbm1lbnRzIDogT2JqZWN0LnZhbHVlcyhjb3Vyc2VEYXRhLkFzc2lnbm1lbnRzKTtcbiAgICAgICAgcmV0dXJuIGxpc3QuZmluZCgoYSkgPT4gU3RyaW5nKGEuaWQpID09PSBTdHJpbmcoc2VsZWN0ZWRBc3NpZ25tZW50SWQpKTtcbiAgICAgIH0sIFtzZWxlY3RlZEFzc2lnbm1lbnRJZCwgY291cnNlRGF0YV0pO1xuXG4gICAgICAvLyBGaW5kIHNlbGVjdGVkIHBhZ2Ugb2JqZWN0IGlmIHZpZXdpbmcgb25lXG4gICAgICBjb25zdCBjdXJyZW50UGFnZSA9IFJlYWN0LnVzZU1lbW8oKCkgPT4ge1xuICAgICAgICBpZiAoIXNlbGVjdGVkUGFnZVVybCB8fCAhY291cnNlRGF0YT8uUGFnZXMpIHJldHVybiBudWxsO1xuICAgICAgICBjb25zdCBsaXN0ID0gQXJyYXkuaXNBcnJheShjb3Vyc2VEYXRhLlBhZ2VzKSA/IGNvdXJzZURhdGEuUGFnZXMgOiBPYmplY3QudmFsdWVzKGNvdXJzZURhdGEuUGFnZXMpO1xuICAgICAgICByZXR1cm4gbGlzdC5maW5kKFxuICAgICAgICAgIChwKSA9PlxuICAgICAgICAgICAgU3RyaW5nKHAudXJsKSA9PT0gU3RyaW5nKHNlbGVjdGVkUGFnZVVybCkgfHxcbiAgICAgICAgICAgIFN0cmluZyhwLnBhZ2VfaWQpID09PSBTdHJpbmcoc2VsZWN0ZWRQYWdlVXJsKSB8fFxuICAgICAgICAgICAgU3RyaW5nKHAuaWQpID09PSBTdHJpbmcoc2VsZWN0ZWRQYWdlVXJsKSxcbiAgICAgICAgKTtcbiAgICAgIH0sIFtzZWxlY3RlZFBhZ2VVcmwsIGNvdXJzZURhdGFdKTtcblxuICAgICAgLy8gRHluYW1pYyBicmVhZGNydW1icyBiYXNlZCBvbiBuYXZpZ2F0aW9uIHN0YXRlLCBuZXZlciBzaG93IGJyZWFkY3J1bWIgZm9yIGZyb250cGFnZVxuICAgICAgY29uc3QgYnJlYWRjcnVtYkxpc3QgPSBSZWFjdC51c2VNZW1vKCgpID0+IHtcbiAgICAgICAgY29uc3QgY3J1bWJzID0gW107XG4gICAgICAgIGlmIChhY3RpdmVLZXkgPT09IFwiYXNzaWdubWVudHNcIikge1xuICAgICAgICAgIGNydW1icy5wdXNoKHtcbiAgICAgICAgICAgIHRpdGxlOiBcIkFzc2lnbm1lbnRzXCIsXG4gICAgICAgICAgICBjYWxsYmFjazogKCkgPT4gbmF2aWdhdGVUb1NlY3Rpb24oXCJhc3NpZ25tZW50c1wiKSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpZiAoY3VycmVudEFzc2lnbm1lbnQpIHtcbiAgICAgICAgICAgIGNydW1icy5wdXNoKHsgdGl0bGU6IGN1cnJlbnRBc3NpZ25tZW50Lm5hbWUgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGFjdGl2ZUtleSA9PT0gXCJwYWdlc1wiKSB7XG4gICAgICAgICAgY3J1bWJzLnB1c2goe1xuICAgICAgICAgICAgdGl0bGU6IFwiUGFnZXNcIixcbiAgICAgICAgICAgIGNhbGxiYWNrOiAoKSA9PiBuYXZpZ2F0ZVRvU2VjdGlvbihcInBhZ2VzXCIpLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmIChjdXJyZW50UGFnZSkge1xuICAgICAgICAgICAgY3J1bWJzLnB1c2goeyB0aXRsZTogY3VycmVudFBhZ2UudGl0bGUgfHwgXCJQYWdlIERldGFpbHNcIiB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoYWN0aXZlS2V5ID09PSBcImZyb250cGFnZVwiKSB7XG4gICAgICAgICAgcmV0dXJuIGNydW1icztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjcnVtYnMucHVzaCh7XG4gICAgICAgICAgICB0aXRsZTogYWN0aXZlS2V5LmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgYWN0aXZlS2V5LnNsaWNlKDEpLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjcnVtYnM7XG4gICAgICB9LCBbYWN0aXZlS2V5LCBjdXJyZW50QXNzaWdubWVudCwgY3VycmVudFBhZ2VdKTtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxtYWluIHN0eWxlPXt7IG1hcmdpbkxlZnQ6IFwiMHB4XCIsIHdpZHRoOiBcIjEwMCVcIiB9fT5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0ndG9wLW5hdic+XG4gICAgICAgICAgICA8YnV0dG9uIGlkPSdjb3Vyc2VNZW51VG9nZ2xlJyBvbkNsaWNrPXsoKSA9PiBzZXRTaG93Q291cnNlTGlzdCghc2hvd0NvdXJzZUxpc3QpfT5cbiAgICAgICAgICAgICAgPHN2ZyB3aWR0aD0nMjQnIGhlaWdodD0nMjQnIHZpZXdCb3g9JzAgMCAyNCAyNCcgZmlsbD0nbm9uZScgc3Ryb2tlPSdjdXJyZW50Q29sb3InIHN0cm9rZVdpZHRoPScyJyBzdHJva2VMaW5lY2FwPSdyb3VuZCc+XG4gICAgICAgICAgICAgICAgPGxpbmUgeDE9JzMnIHkxPScxMicgeDI9JzIxJyB5Mj0nMTInPjwvbGluZT5cbiAgICAgICAgICAgICAgICA8bGluZSB4MT0nMycgeTE9JzYnIHgyPScyMScgeTI9JzYnPjwvbGluZT5cbiAgICAgICAgICAgICAgICA8bGluZSB4MT0nMycgeTE9JzE4JyB4Mj0nMjEnIHkyPScxOCc+PC9saW5lPlxuICAgICAgICAgICAgICA8L3N2Zz5cbiAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgPFRvcEJyZWFkY3J1bWJzIGxpc3Q9e2JyZWFkY3J1bWJMaXN0fSAvPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgIGNsYXNzTmFtZT0nYm90dG9tX3NlY3Rpb24nXG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIixcbiAgICAgICAgICAgICAgZmxleERpcmVjdGlvbjogXCJyb3dcIixcbiAgICAgICAgICAgICAgYWxpZ25JdGVtczogXCJmbGV4LXN0YXJ0XCIsIC8vIFByZXZlbnRzIGZ1bGwtaGVpZ2h0IHN0cmV0Y2hpbmcgc28gc3RpY2tpbmVzcyB3b3Jrc1xuICAgICAgICAgICAgICBtYXJnaW5SaWdodDogXCIyMHB4XCIsXG4gICAgICAgICAgICAgIG1hcmdpbkxlZnQ6IFwiMjBweFwiLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICB7c2hvd0NvdXJzZUxpc3QgJiYgPENvdXJzZUxpc3QgZWxlbWVudHM9e2VsZW1lbnRzfSBhY3RpdmVLZXk9e2FjdGl2ZUtleX0gY2FsbGJhY2s9eyhrZXkpID0+IG5hdmlnYXRlVG9TZWN0aW9uKGtleSl9IC8+fVxuICAgICAgICAgICAge3JlbmRlckFjdGl2ZUNvbnRlbnQoYWN0aXZlS2V5LCBjdXJyZW50QXNzaWdubWVudCwgY3VycmVudFBhZ2UsIHNlbGVjdGVkRGlzY3Vzc2lvbklkLCBzZWxlY3RlZEFubm91bmNlbWVudElkKX1cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9tYWluPlxuICAgICAgKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogU3dpdGNoIHN0YXRlbWVudCB0byByZW5kZXIgdGhlIGFwcHJvcHJpYXRlIGNvbnRlbnQgYmFzZWQgb24gdGhlIGFjdGl2ZUtleS4gSXQgY3VycmVudGx5IGhhbmRsZXMgdGhlIFwiZnJvbnRQYWdlXCIgY2FzZSBhbmQgYSBkZWZhdWx0IGNhc2UgZm9yIG90aGVyIGtleXMuXG4gICAgICovXG4gICAgZnVuY3Rpb24gcmVuZGVyQWN0aXZlQ29udGVudChhY3RpdmVLZXksIGN1cnJlbnRBc3NpZ25tZW50LCBjdXJyZW50UGFnZSwgc2VsZWN0ZWREaXNjdXNzaW9uSWQsIHNlbGVjdGVkQW5ub3VuY2VtZW50SWQpIHtcbiAgICAgIHN3aXRjaCAoYWN0aXZlS2V5KSB7XG4gICAgICAgIGNhc2UgXCJhc3NpZ25tZW50c1wiOlxuICAgICAgICAgIHJldHVybiBjdXJyZW50QXNzaWdubWVudCA/IDxBc3NpZ25tZW50RGV0YWlsVmlldyBhc3NpZ25tZW50PXtjdXJyZW50QXNzaWdubWVudH0gLz4gOiA8QXNzaWdubWVudHNQYWdlIC8+O1xuICAgICAgICBjYXNlIFwiZ3JhZGVzXCI6XG4gICAgICAgICAgcmV0dXJuIDxHcmFkZXNQYWdlIC8+O1xuICAgICAgICBjYXNlIFwibW9kdWxlc1wiOlxuICAgICAgICAgIHJldHVybiA8TW9kdWxlc1BhZ2UgLz47XG4gICAgICAgIGNhc2UgXCJwYWdlc1wiOlxuICAgICAgICAgIHJldHVybiBjdXJyZW50UGFnZSA/IDxQYWdlRGV0YWlsVmlldyBwYWdlPXtjdXJyZW50UGFnZX0gLz4gOiA8UGFnZXNQYWdlIC8+O1xuICAgICAgICBjYXNlIFwiZmlsZXNcIjpcbiAgICAgICAgICByZXR1cm4gPEZpbGVzUGFnZSAvPjtcbiAgICAgICAgY2FzZSBcImRpc2N1c3Npb25zXCI6XG4gICAgICAgICAgcmV0dXJuIHNlbGVjdGVkRGlzY3Vzc2lvbklkID8gPERpc2N1c3Npb25EZXRhaWxWaWV3IGRpc2N1c3Npb25JZD17c2VsZWN0ZWREaXNjdXNzaW9uSWR9IC8+IDogPERpc2N1c3Npb25zUGFnZSAvPjtcbiAgICAgICAgY2FzZSBcImFubm91bmNlbWVudHNcIjpcbiAgICAgICAgICByZXR1cm4gc2VsZWN0ZWRBbm5vdW5jZW1lbnRJZCA/IDxBbm5vdW5jZW1lbnREZXRhaWxQYWdlIC8+IDogPEFubm91bmNlbWVudHNQYWdlIC8+O1xuICAgICAgICBjYXNlIFwiZnJvbnRwYWdlXCI6XG4gICAgICAgICAgcmV0dXJuIDxIb21lUGFnZSAvPjtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J2NhbnZhc19jb250ZW50Jz5cbiAgICAgICAgICAgICAgV2UgYXJlIHNvcnJ5LCBidXQgdGhlIHNlY3Rpb24geW91IGFyZSB0cnlpbmcgdG8gdmlzaXQgaGFzIGVpdGhlciBub3QgYmVlbiBpbXBsZW1lbmVudGVkIG9yIHRoZXJlIGlzIGEgcHJvYmxlbSB3aXRoIHRoZSBjb3Vyc2UgZGF0YS5cbiAgICAgICAgICAgICAgPGgxPkFjdGl2ZSBrZXk6IHthY3RpdmVLZXl9PC9oMT5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSIsIi8qKlxuICogXG4gKiBAcmV0dXJucyBUaGUgbWFpbiB2aWV3ZXJcbiAqL1xuZnVuY3Rpb24gTW9kdWxlc1BhZ2UoKSB7XG4gIGNvbnN0IHsgY291cnNlRGF0YSB9ID0gdXNlQ291cnNlQ29udGV4dCgpO1xuICBjb25zdCB7IHVzZVN0YXRlLCB1c2VNZW1vIH0gPSBSZWFjdDtcbiAgaWYgKCFjb3Vyc2VEYXRhKSB7XG4gICAgcmV0dXJuIDxkaXY+TG9hZGluZy4uLjwvZGl2PjtcbiAgfVxuICBpZiAoIWNvdXJzZURhdGEuTW9kdWxlcykge1xuICAgIHJldHVybiA8ZGl2Pk5vIG1vZHVsZXMgYXZhaWxhYmxlLjwvZGl2PjtcbiAgfVxuICAvLyBDb252ZXJ0IGRpY3Rpb25hcnkgb2JqZWN0IG9yIGFycmF5IGludG8gYSBmbGF0IGFycmF5IG9mIG1vZHVsZXNcbiAgY29uc3QgbW9kdWxlTGlzdCA9IEFycmF5LmlzQXJyYXkoY291cnNlRGF0YS5Nb2R1bGVzKSA/IGNvdXJzZURhdGEuTW9kdWxlcyA6IE9iamVjdC52YWx1ZXMoY291cnNlRGF0YS5Nb2R1bGVzKTtcblxuICBjb25zdCBbb3BlblN0YXRlcywgc2V0T3BlblN0YXRlc10gPSB1c2VTdGF0ZSgoKSA9PiB7XG4gICAgY29uc3QgaW5pdGlhbCA9IHt9O1xuICAgIG1vZHVsZUxpc3QuZm9yRWFjaCgobSkgPT4ge1xuICAgICAgaW5pdGlhbFttLmlkXSA9IHRydWU7XG4gICAgfSk7XG4gICAgcmV0dXJuIGluaXRpYWw7XG4gIH0pO1xuICAvLyBEZXJpdmVkIHN0YXRlOiBJZiBBVCBMRUFTVCBPTkUgbW9kdWxlIGlzIG9wZW4sIGJ1dHRvbiBhY3Rpb24gaXMgXCJDb2xsYXBzZSBBbGxcIi5cbiAgLy8gSWYgQUxMIG1vZHVsZXMgYXJlIGNvbGxhcHNlZCAobm9uZSBhcmUgb3BlbiksIGJ1dHRvbiBhY3Rpb24gaXMgXCJFeHBhbmQgQWxsXCIuXG4gIGNvbnN0IGlzQW55T3BlbiA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKG9wZW5TdGF0ZXMpLnNvbWUoKGlzT3BlbikgPT4gaXNPcGVuID09PSB0cnVlKTtcbiAgfSwgW29wZW5TdGF0ZXNdKTtcblxuICAvLyBUb2dnbGUgaW5kaXZpZHVhbCBtb2R1bGUgaGVhZGVyIGNsaWNrXG4gIGNvbnN0IGhhbmRsZVRvZ2dsZU1vZHVsZSA9IChpZCkgPT4ge1xuICAgIHNldE9wZW5TdGF0ZXMoKHByZXYpID0+ICh7XG4gICAgICAuLi5wcmV2LFxuICAgICAgW2lkXTogIXByZXZbaWRdLFxuICAgIH0pKTtcbiAgfTtcblxuICAvLyBNYXN0ZXIgYnV0dG9uIHRvZ2dsZSBoYW5kbGVyXG4gIGNvbnN0IGhhbmRsZU1hc3RlclRvZ2dsZSA9ICgpID0+IHtcbiAgICBjb25zdCBuZXh0U3RhdGUgPSAhaXNBbnlPcGVuOyAvLyBJZiBhbnkgb3BlbiAtPiBoaWRlIGFsbCAoZmFsc2UpOyBpZiBhbGwgY2xvc2VkIC0+IGV4cGFuZCBhbGwgKHRydWUpXG4gICAgY29uc3QgdXBkYXRlZCA9IHt9O1xuICAgIG1vZHVsZUxpc3QuZm9yRWFjaCgobSkgPT4ge1xuICAgICAgdXBkYXRlZFttLmlkXSA9IG5leHRTdGF0ZTtcbiAgICB9KTtcbiAgICBzZXRPcGVuU3RhdGVzKHVwZGF0ZWQpO1xuICB9O1xuICBjb25zdCBoYW5kbGVJdGVtVHlwZSA9IChpdGVtKSA9PiB7XG4gICAgaWYgKCFpdGVtIHx8ICFpdGVtLnR5cGUpIHJldHVybiBcImFzc2lnbm1lbnRcIjsgLy8gRGVmYXVsdCB0byBhc3NpZ25tZW50IGlmIHR5cGUgaXMgbWlzc2luZ1xuICAgIGlmIChpdGVtPy5xdWl6X2x0aSAmJiBpdGVtPy5xdWl6X2x0aSA9PSB0cnVlKSB7XG4gICAgICByZXR1cm4gXCJxdWl6XCI7XG4gICAgfVxuICAgIHJldHVybiBpdGVtLnR5cGUudG9Mb3dlckNhc2UoKTsgLy8gUmV0dXJuIHRoZSB0eXBlIGluIGxvd2VyY2FzZSBmb3IgY29uc2lzdGVuY3lcbiAgfTtcblxuICByZXR1cm4gKFxuICAgIDxkaXZcbiAgICAgIGNsYXNzTmFtZT0ncGFnZS1kaXYnXG4gICAgICBzdHlsZT17e1xuICAgICAgICBtYXJnaW5Cb3R0b206IFwiNGVtXCIsXG4gICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICBmbGV4RGlyZWN0aW9uOiBcImNvbHVtblwiLFxuICAgICAgfX1cbiAgICA+XG4gICAgICA8ZGl2XG4gICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsXG4gICAgICAgICAganVzdGlmeUNvbnRlbnQ6IFwic3BhY2UtYmV0d2VlblwiLFxuICAgICAgICAgIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsXG4gICAgICAgIH19XG4gICAgICA+XG4gICAgICAgIDxoMSBzdHlsZT17eyBjb2xvcjogXCIjNjY2NjY2XCIsIGZvbnRTaXplOiAyOC44IH19Pk1vZHVsZXM8L2gxPlxuICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgb25DbGljaz17aGFuZGxlTWFzdGVyVG9nZ2xlfVxuICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiI2YyZjRmNFwiLFxuICAgICAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCAjZThlYWVjXCIsXG4gICAgICAgICAgICBwYWRkaW5nOiBcIjhweCAxNHB4IDhweCAxNHB4XCIsXG4gICAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiM3B4XCIsXG4gICAgICAgICAgICBjdXJzb3I6IFwicG9pbnRlclwiLFxuICAgICAgICAgICAgZm9udFNpemU6IFwiMTZweFwiLFxuICAgICAgICAgICAgY29sb3I6IFwiIzI3MzU0MFwiLFxuICAgICAgICAgIH19XG4gICAgICAgID5cbiAgICAgICAgICB7aXNBbnlPcGVuID8gXCJDb2xsYXBzZSBBbGxcIiA6IFwiRXhwYW5kIEFsbFwifVxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgICAge21vZHVsZUxpc3QubWFwKChtb2R1bGUsIGluZGV4KSA9PiAoXG4gICAgICAgIDxDb2xsYXBzZVRhYmxlXG4gICAgICAgICAgdGl0bGU9e21vZHVsZS5uYW1lfVxuICAgICAgICAgIHN0eWxlPXt7IG1hcmdpbkJvdHRvbTogXCI0ZW1cIiB9fVxuICAgICAgICAgIGtleT17bW9kdWxlLmlkfVxuICAgICAgICAgIGlzTW9kdWxlSXRlbT17dHJ1ZX1cbiAgICAgICAgICBpc09wZW49e29wZW5TdGF0ZXNbbW9kdWxlLmlkXSA/PyB0cnVlfVxuICAgICAgICAgIG9uVG9nZ2xlPXsoKSA9PiBoYW5kbGVUb2dnbGVNb2R1bGUobW9kdWxlLmlkKX1cbiAgICAgICAgPlxuICAgICAgICAgIHttb2R1bGUuaXRlbXMubWFwKChpdGVtLCBpdGVtSW5kZXgpID0+IChcbiAgICAgICAgICAgIDxDb2xsYXBzZUxpc3RJdGVtRGV0YWlsc1xuICAgICAgICAgICAgICBrZXk9e2l0ZW0uaWR9XG4gICAgICAgICAgICAgIGNsb3NlZD17aXRlbT8uYXZhaWxhYmlsaXR5X3N0YXR1cz8uc3RhdHVzIHx8IFwiVW5rbm93blwifSAvLyBVc2VzICdhdmFpbGFiaWxpdHlfc3RhdHVzLnN0YXR1cycgZnJvbSBDYW52YXMgSlNPTlxuICAgICAgICAgICAgICB0aXRsZT17aXRlbT8udGl0bGUgfHwgXCJObyBUaXRsZVwifSAvLyBVc2VzICd0aXRsZScgZnJvbSBDYW52YXMgSlNPTlxuICAgICAgICAgICAgICBkdWVEYXRlPXtpdGVtPy5kdWVfYXQgPyBmaXhEYXRlRm9ybWF0KGl0ZW0/LmR1ZV9hdCkgOiBcIk5vIER1ZSBEYXRlXCJ9XG4gICAgICAgICAgICAgIGdyYWRlPXtpdGVtPy5zdWJtaXNzaW9uPy5zY29yZSB8fCBcIi1cIn1cbiAgICAgICAgICAgICAgbWF4R3JhZGU9e2l0ZW0/LnBvaW50c19wb3NzaWJsZX0gLy8gVXNlcyAncG9pbnRzX3Bvc3NpYmxlJyBmcm9tIENhbnZhcyBKU09OXG4gICAgICAgICAgICAgIHR5cGU9e2hhbmRsZUl0ZW1UeXBlKGl0ZW0pfSAvLyBVc2VzICd0eXBlJyBmcm9tIENhbnZhcyBKU09OLCBjb252ZXJ0ZWQgdG8gbG93ZXJjYXNlXG4gICAgICAgICAgICAgIGFzc2lnbm1lbnQ9e2l0ZW0udHlwZSA9PSBcIkFzc2lnbm1lbnRcIiA/IGl0ZW0gOiB1bmRlZmluZWR9XG4gICAgICAgICAgICAgIHBhZ2VVcmw9e2l0ZW0udHlwZSA9PSBcIlBhZ2VcIiA/IGl0ZW0ucGFnZV91cmwgfHwgaXRlbS51cmwgOiB1bmRlZmluZWR9XG4gICAgICAgICAgICAgIGlzTW9kdWxlSXRlbT17dHJ1ZX1cbiAgICAgICAgICAgICAgaW5kZW50PXtpdGVtPy5pbmRlbnQgPz8gMH0gLy8gVXNlcyAnaW5kZW50JyBmcm9tIENhbnZhcyBKU09OIHRvIGRldGVybWluZSB0aGUgaW5kZW50YXRpb24gbGV2ZWwgb2YgdGhlIG1vZHVsZSBpdGVtXG4gICAgICAgICAgICAvPlxuICAgICAgICAgICkpfVxuICAgICAgICA8L0NvbGxhcHNlVGFibGU+XG4gICAgICApKX1cbiAgICA8L2Rpdj5cbiAgKTtcbn1cbiIsIi8qKlxuICogQ2FudmFzLWVzcXVlIG5hbWUgcHJvZmlsZSBjYXJkXG4gKiBAcGFyYW0ge09iamVjdH0gcHJvcHNcbiAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wcy5uYW1lIC0gVGhlIG5hbWUgdG8gZGlzcGxheVxuICogQHBhcmFtIHtzdHJpbmd9IHByb3BzLmRhdGUgLSBUaGUgZGF0ZSB0byBkaXNwbGF5XG4gKiBAcGFyYW0ge2Jvb2xlYW59IHByb3BzLmluY2x1ZGVQcm9maWxlQ2lyY2xlIC0gV2hldGhlciB0byBpbmNsdWRlIHRoZSBwcm9maWxlIGNpcmNsZVxuICogQHBhcmFtIHtib29sZWFufSBwcm9wcy5pbmNsdWRlTmFtZSAtIFdoZXRoZXIgdG8gaW5jbHVkZSB0aGUgbmFtZVxuICogQHBhcmFtIHtPYmplY3R9IHByb3BzLm5hbWVTdHlsZSAtIFRoZSBzdHlsZSB0byBhcHBseSB0byB0aGUgbmFtZSAoYW5kIGRhdGUpXG4gKiBAcmV0dXJucyB7UmVhY3QuQ29tcG9uZW50fSBUaGUgbmFtZSBwcm9maWxlIGNhcmRcbiAqL1xuZnVuY3Rpb24gTmFtZVByb2ZpbGVDYXJkKHsgbmFtZSwgZGF0ZSwgaW5jbHVkZVByb2ZpbGVDaXJjbGUgPSB0cnVlLCBpbmNsdWRlTmFtZSA9IHRydWUsIG5hbWVTdHlsZSB9KSB7XG4gIGxldCBpbml0aWFscyA9IG5hbWVcbiAgICAuc3BsaXQoXCIgXCIpXG4gICAgLm1hcCgobmFtZSkgPT4gbmFtZVswXSlcbiAgICAuam9pbihcIlwiKTtcbiAgaW5pdGlhbHMgPSBpbml0aWFscy50b1VwcGVyQ2FzZSgpO1xuICBsZXQgZGF0ZVN0cmluZyA9IFwiLVwiO1xuICBpZiAoZGF0ZSkge1xuICAgIGRhdGVTdHJpbmcgPSBmaXhEYXRlRm9ybWF0KGRhdGUpO1xuICB9XG4gIHJldHVybiAoXG4gICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiBcImZsZXhcIiwgYWxpZ25JdGVtczogXCJjZW50ZXJcIiwgZ2FwOiBcIjFlbVwiIH19PlxuICAgICAge2luY2x1ZGVQcm9maWxlQ2lyY2xlICYmIChcbiAgICAgICAgPGRpdlxuICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICBib3JkZXI6IFwiMnB4IHNvbGlkIHJnYigxNDEsIDE0OSwgMTU5KVwiLFxuICAgICAgICAgICAgY29sb3I6IFwicmdiKDQzLCAxMjIsIDE4OClcIixcbiAgICAgICAgICAgIGZvbnRXZWlnaHQ6IFwiNzAwXCIsXG4gICAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiNTAlXCIsXG4gICAgICAgICAgICBtaW5IZWlnaHQ6IFwiNTBweFwiLFxuICAgICAgICAgICAgbWluV2lkdGg6IFwiNTBweFwiLFxuICAgICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsXG4gICAgICAgICAgICBqdXN0aWZ5Q29udGVudDogXCJjZW50ZXJcIixcbiAgICAgICAgICAgIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsXG4gICAgICAgICAgICBmb250U2l6ZTogXCIxLjI1IHJlbVwiLFxuICAgICAgICAgIH19XG4gICAgICAgID5cbiAgICAgICAgICB7aW5pdGlhbHN9XG4gICAgICAgIDwvZGl2PlxuICAgICAgKX1cbiAgICAgIHtpbmNsdWRlTmFtZSAmJiAoXG4gICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogXCJmbGV4XCIsIGZsZXhEaXJlY3Rpb246IFwiY29sdW1uXCIsIC4uLm5hbWVTdHlsZSB9fT5cbiAgICAgICAgICA8c3BhbiBzdHlsZT17eyBmb250V2VpZ2h0OiBcImJvbGRcIiB9fT57bmFtZX08L3NwYW4+XG4gICAgICAgICAgPHNwYW4gc3R5bGU9e3sgY29sb3I6IFwicmdiKDk5LCAxMDksIDExNylcIiB9fT57ZGF0ZVN0cmluZ308L3NwYW4+XG4gICAgICAgIDwvZGl2PlxuICAgICAgKX1cbiAgICA8L2Rpdj5cbiAgKTtcbn1cbiIsIi8qKlxuICogUmVuZGVycyB0aGUgcGFnZSBzZWxlY3RlZCBieSB0aGUgdXNlciB1c2luZyBfZGFuZ2Vyb3VzbHlTZXRJbm5lckhUTUxcbiAqIEBwYXJhbSB7T2JqZWN0fSBwYWdlIC0gVGhlIHBhZ2Ugb2JqZWN0IGZyb20gdGhlIGNvdXJzZSBkYXRhXG4gKiBAcmV0dXJucyB7UmVhY3QuQ29tcG9uZW50fSBUaGUgcGFnZSBkZXRhaWwgdmlld1xuICovXG5mdW5jdGlvbiBQYWdlRGV0YWlsVmlldyh7IHBhZ2UgfSkge1xuICBjb25zdCB7IGRpckhhbmRsZSB9ID0gdXNlQ291cnNlQ29udGV4dCgpO1xuICBjb25zdCBbYm9keUh0bWwsIHNldEJvZHlIdG1sXSA9IHVzZVN0YXRlKHBhZ2U/LmJvZHkgfHwgbnVsbCk7XG4gIGNvbnN0IFtpc0xvYWRpbmcsIHNldElzTG9hZGluZ10gPSB1c2VTdGF0ZSghcGFnZT8uYm9keSk7XG4gIGNvbnN0IFtlcnJvciwgc2V0RXJyb3JdID0gdXNlU3RhdGUobnVsbCk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBsZXQgaXNNb3VudGVkID0gdHJ1ZTtcblxuICAgIGFzeW5jIGZ1bmN0aW9uIGxvYWRQYWdlQm9keSgpIHtcbiAgICAgIGlmIChwYWdlPy5ib2R5KSB7XG4gICAgICAgIHNldEJvZHlIdG1sKHBhZ2UuYm9keSk7XG4gICAgICAgIHNldElzTG9hZGluZyhmYWxzZSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKCFkaXJIYW5kbGUpIHtcbiAgICAgICAgc2V0SXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICBzZXRJc0xvYWRpbmcodHJ1ZSk7XG4gICAgICAgIHNldEVycm9yKG51bGwpO1xuXG4gICAgICAgIGxldCBwYWdlc0hhbmRsZSA9IG51bGw7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcGFnZXNIYW5kbGUgPSBhd2FpdCBkaXJIYW5kbGUuZ2V0RGlyZWN0b3J5SGFuZGxlKFwiUGFnZXNcIik7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGNvbnNvbGUud2FybihcIlBhZ2VzIGRpcmVjdG9yeSBoYW5kbGUgbm90IGZvdW5kOlwiLCBlcnIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFwYWdlc0hhbmRsZSkge1xuICAgICAgICAgIGlmIChpc01vdW50ZWQpIHtcbiAgICAgICAgICAgIHNldEVycm9yKFwiUGFnZXMgZm9sZGVyIG5vdCBmb3VuZCBsb2NhbGx5LlwiKTtcbiAgICAgICAgICAgIHNldElzTG9hZGluZyhmYWxzZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRhcmdldFVybFJhdyA9IChwYWdlLnVybCB8fCBwYWdlLnRpdGxlIHx8IFwiXCIpLnRvTG93ZXJDYXNlKCkudHJpbSgpO1xuICAgICAgICBjb25zdCB0YXJnZXRVcmxTYW5pdGl6ZWQgPSBzYW5pdGl6ZUZpbGVuYW1lKHBhZ2UudXJsIHx8IHBhZ2UudGl0bGUgfHwgXCJcIilcbiAgICAgICAgICAudG9Mb3dlckNhc2UoKVxuICAgICAgICAgIC50cmltKCk7XG4gICAgICAgIGxldCBtYXRjaGVkRmlsZUhhbmRsZSA9IG51bGw7XG5cbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBlbnRyeSBvZiBwYWdlc0hhbmRsZS52YWx1ZXMoKSkge1xuICAgICAgICAgIGlmIChlbnRyeS5raW5kID09PSBcImZpbGVcIiAmJiAoZW50cnkubmFtZS5lbmRzV2l0aChcIi5odG1sXCIpIHx8IGVudHJ5Lm5hbWUuZW5kc1dpdGgoXCIuaHRtXCIpKSkge1xuICAgICAgICAgICAgY29uc3QgbmFtZVdpdGhvdXRFeHQgPSBlbnRyeS5uYW1lXG4gICAgICAgICAgICAgIC5yZXBsYWNlKC9cXC5odG1sPyQvaSwgXCJcIilcbiAgICAgICAgICAgICAgLnRvTG93ZXJDYXNlKClcbiAgICAgICAgICAgICAgLnRyaW0oKTtcbiAgICAgICAgICAgIGNvbnN0IG5hbWVTYW5pdGl6ZWQgPSBzYW5pdGl6ZUZpbGVuYW1lKG5hbWVXaXRob3V0RXh0KS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcblxuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICBuYW1lV2l0aG91dEV4dCA9PT0gdGFyZ2V0VXJsUmF3IHx8XG4gICAgICAgICAgICAgIG5hbWVTYW5pdGl6ZWQgPT09IHRhcmdldFVybFNhbml0aXplZCB8fFxuICAgICAgICAgICAgICBuYW1lV2l0aG91dEV4dC5pbmNsdWRlcyh0YXJnZXRVcmxTYW5pdGl6ZWQpIHx8XG4gICAgICAgICAgICAgIHRhcmdldFVybFNhbml0aXplZC5pbmNsdWRlcyhuYW1lU2FuaXRpemVkKVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgIG1hdGNoZWRGaWxlSGFuZGxlID0gZW50cnk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtYXRjaGVkRmlsZUhhbmRsZSkge1xuICAgICAgICAgIGNvbnN0IGZpbGUgPSBhd2FpdCBtYXRjaGVkRmlsZUhhbmRsZS5nZXRGaWxlKCk7XG4gICAgICAgICAgY29uc3QgdGV4dCA9IGF3YWl0IGZpbGUudGV4dCgpO1xuICAgICAgICAgIGlmIChpc01vdW50ZWQpIHtcbiAgICAgICAgICAgIHNldEJvZHlIdG1sKHRleHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAoaXNNb3VudGVkKSB7XG4gICAgICAgICAgICBzZXRFcnJvcihcIlBhZ2UgY29udGVudCBmaWxlIG5vdCBmb3VuZCBsb2NhbGx5LlwiKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgcmVhZGluZyBsb2NhbCBwYWdlIGZpbGU6XCIsIGVycik7XG4gICAgICAgIGlmIChpc01vdW50ZWQpIHtcbiAgICAgICAgICBzZXRFcnJvcihcIkZhaWxlZCB0byBsb2FkIHBhZ2UgY29udGVudC5cIik7XG4gICAgICAgIH1cbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIGlmIChpc01vdW50ZWQpIHtcbiAgICAgICAgICBzZXRJc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgbG9hZFBhZ2VCb2R5KCk7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGlzTW91bnRlZCA9IGZhbHNlO1xuICAgIH07XG4gIH0sIFtwYWdlLCBkaXJIYW5kbGVdKTtcblxuICBpZiAoIXBhZ2UpIHtcbiAgICByZXR1cm4gPGgxPk5vIFBhZ2UgU2VsZWN0ZWQ8L2gxPjtcbiAgfVxuXG4gIGZ1bmN0aW9uIGN1c3RvbURhdGVGb3JtYXQoZGF0ZVN0cikge1xuICAgIGlmICghZGF0ZVN0cikgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgZGF0ZU9iaiA9IG5ldyBEYXRlKGRhdGVTdHIpO1xuICAgIHJldHVybiBkYXRlT2JqLnRvTG9jYWxlRGF0ZVN0cmluZyhcImVuLVVTXCIsIHtcbiAgICAgIHdlZWtkYXk6IFwic2hvcnRcIixcbiAgICAgIG1vbnRoOiBcInNob3J0XCIsXG4gICAgICBkYXk6IFwibnVtZXJpY1wiLFxuICAgICAgeWVhcjogXCJudW1lcmljXCIsXG4gICAgICBob3VyOiBcIm51bWVyaWNcIixcbiAgICAgIG1pbnV0ZTogXCJudW1lcmljXCIsXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxkaXZcbiAgICAgIHN0eWxlPXt7XG4gICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICBmbGV4RGlyZWN0aW9uOiBcImNvbHVtblwiLFxuICAgICAgICB3aWR0aDogXCIxMDAlXCIsXG4gICAgICAgIG1hcmdpbkJvdHRvbTogXCI4ZW1cIixcbiAgICAgIH19XG4gICAgPlxuICAgICAgPGRpdiBjbGFzc05hbWU9J2Fzc2lnbm1lbnQtc3R1ZGVudC1oZWFkZXInIHN0eWxlPXt7IGJvcmRlckJvdHRvbTogXCIycHggc29saWQgIzM5NDU0ZVwiLCBwYWRkaW5nQm90dG9tOiBcIjAuNzVlbVwiIH19PlxuICAgICAgICA8c3BhbiBzdHlsZT17eyBkaXNwbGF5OiBcImZsZXhcIiwgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIiB9fT5cbiAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9J2Fzc2lnbm1lbnQtc3R1ZGVudC1oZWFkZXItdGl0bGUnPntwYWdlLnRpdGxlfTwvc3Bhbj5cbiAgICAgICAgICA8c3BhbiBzdHlsZT17eyBmb250U2l6ZTogXCIxNHB4XCIsIGNvbG9yOiBcIiM1NTVcIiwgbWFyZ2luVG9wOiBcIjRweFwiIH19PlxuICAgICAgICAgICAge3BhZ2UudXBkYXRlZF9hdFxuICAgICAgICAgICAgICA/IGBMYXN0IHVwZGF0ZWQ6ICR7Y3VzdG9tRGF0ZUZvcm1hdChwYWdlLnVwZGF0ZWRfYXQpfWBcbiAgICAgICAgICAgICAgOiBwYWdlLmNyZWF0ZWRfYXRcbiAgICAgICAgICAgICAgICA/IGBDcmVhdGVkOiAke2N1c3RvbURhdGVGb3JtYXQocGFnZS5jcmVhdGVkX2F0KX1gXG4gICAgICAgICAgICAgICAgOiBcIlwifVxuICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgPC9zcGFuPlxuICAgICAgICB7cGFnZS5mcm9udF9wYWdlICYmIChcbiAgICAgICAgICA8c3BhblxuICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBcIiMwMDg0MmNcIixcbiAgICAgICAgICAgICAgY29sb3I6IFwiI2ZmZlwiLFxuICAgICAgICAgICAgICBwYWRkaW5nOiBcIjRweCAxMHB4XCIsXG4gICAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCIxMnB4XCIsXG4gICAgICAgICAgICAgIGZvbnRTaXplOiBcIjEycHhcIixcbiAgICAgICAgICAgICAgZm9udFdlaWdodDogXCJib2xkXCIsXG4gICAgICAgICAgICAgIGFsaWduU2VsZjogXCJjZW50ZXJcIixcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgPlxuICAgICAgICAgICAgRnJvbnQgUGFnZVxuICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgKX1cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8ZGl2IHN0eWxlPXt7IG1hcmdpblRvcDogXCIxLjVlbVwiIH19PlxuICAgICAgICB7aXNMb2FkaW5nICYmIDxkaXYgc3R5bGU9e3sgY29sb3I6IFwiIzY2NlwiLCBwYWRkaW5nOiBcIjFlbVwiIH19PkxvYWRpbmcgcGFnZSBjb250ZW50Li4uPC9kaXY+fVxuICAgICAgICB7ZXJyb3IgJiYgPGRpdiBzdHlsZT17eyBjb2xvcjogXCIjYzAwXCIsIHBhZGRpbmc6IFwiMWVtXCIsIGJhY2tncm91bmRDb2xvcjogXCIjZmVlXCIsIGJvcmRlclJhZGl1czogXCI0cHhcIiB9fT57ZXJyb3J9PC9kaXY+fVxuICAgICAgICB7IWlzTG9hZGluZyAmJiAhZXJyb3IgJiYgYm9keUh0bWwgJiYgPGRpdiBjbGFzc05hbWU9J2Fzc2lnbm1lbnQtZGV0YWlscycgZGFuZ2Vyb3VzbHlTZXRJbm5lckhUTUw9e3sgX19odG1sOiBib2R5SHRtbCB9fSAvPn1cbiAgICAgICAgeyFpc0xvYWRpbmcgJiYgIWVycm9yICYmICFib2R5SHRtbCAmJiA8ZGl2IHN0eWxlPXt7IGNvbG9yOiBcIiM2NjZcIiwgcGFkZGluZzogXCIxZW1cIiB9fT5ObyBjb250ZW50IGF2YWlsYWJsZSBmb3IgdGhpcyBwYWdlLjwvZGl2Pn1cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufVxuIiwiLyoqXG4gKiBDcmVhdGVzIHRoZSBsaXN0IG9mIHBhZ2VzIGZvciB0aGUgY291cnNlLlxuICogQHJldHVybnMge0pTWC5FbGVtZW50fSBsaXN0IG9mIHBhZ2VzIGZvciB0aGUgZW50aXJlIGNvdXJzZVxuICovXG5mdW5jdGlvbiBQYWdlc1BhZ2UoKSB7XG4gIGNvbnN0IHsgY291cnNlRGF0YSB9ID0gdXNlQ291cnNlQ29udGV4dCgpO1xuICBjb25zdCB7IG5hdmlnYXRlVG9QYWdlIH0gPSB1c2VOYXZpZ2F0aW9uKCk7XG5cbiAgaWYgKCFjb3Vyc2VEYXRhKSB7XG4gICAgcmV0dXJuIDxkaXY+TG9hZGluZy4uLjwvZGl2PjtcbiAgfVxuICBpZiAoIWNvdXJzZURhdGEuUGFnZXMgfHwgY291cnNlRGF0YS5QYWdlcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gPGRpdj5ObyBwYWdlcyBhdmFpbGFibGUuPC9kaXY+O1xuICB9XG5cbiAgY29uc3QgcGFnZXNMaXN0ID0gQXJyYXkuaXNBcnJheShjb3Vyc2VEYXRhLlBhZ2VzKSA/IGNvdXJzZURhdGEuUGFnZXMgOiBPYmplY3QudmFsdWVzKGNvdXJzZURhdGEuUGFnZXMpO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBzdHlsZT17eyB3aWR0aDogXCIxMDAlXCIsIG1hcmdpbkJvdHRvbTogXCI4ZW1cIiB9fT5cbiAgICAgIDxoMSBzdHlsZT17eyBjb2xvcjogXCIjNjY2NjY2XCIsIGZvbnRTaXplOiAyOC44IH19PlBhZ2VzPC9oMT5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPSdwYWdlcy1jb250YWluZXInIHN0eWxlPXt7IHdpZHRoOiBcIjEwMCVcIiB9fT5cbiAgICAgICAgPHRhYmxlIGNsYXNzTmFtZT0ncGFnZXMtdGFibGUnIHN0eWxlPXt7IHdpZHRoOiBcIjEwMCVcIiB9fT5cbiAgICAgICAgICA8dGhlYWQ+XG4gICAgICAgICAgICA8dHIgc3R5bGU9e3sgYm9yZGVyQm90dG9tOiBcIjJweCBzb2xpZCByZ2IoMzksIDUzLCA2NClcIiB9fT5cbiAgICAgICAgICAgICAgPHRoIHN0eWxlPXt7IG1pbldpZHRoOiBcImZpdC1jb250ZW50XCIsIHdoaXRlU3BhY2U6IFwibm93cmFwXCIgfX0+VGl0bGU8L3RoPlxuICAgICAgICAgICAgICA8dGggc3R5bGU9e3sgbWluV2lkdGg6IFwiZml0LWNvbnRlbnRcIiwgd2hpdGVTcGFjZTogXCJub3dyYXBcIiB9fT5DcmVhdGlvbiBEYXRlPC90aD5cbiAgICAgICAgICAgICAgPHRoIHN0eWxlPXt7IG1pbldpZHRoOiBcImZpdC1jb250ZW50XCIsIHdoaXRlU3BhY2U6IFwibm93cmFwXCIgfX0+VXBkYXRlZCBhdDwvdGg+XG4gICAgICAgICAgICA8L3RyPlxuICAgICAgICAgIDwvdGhlYWQ+XG4gICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAge3BhZ2VzTGlzdC5tYXAoKHBhZ2UsIGluZGV4KSA9PiAoXG4gICAgICAgICAgICAgIDx0ciBrZXk9e3BhZ2UucGFnZV9pZCB8fCBwYWdlLnVybCB8fCBwYWdlLmlkIHx8IGluZGV4fSBzdHlsZT17eyBiYWNrZ3JvdW5kQ29sb3I6IGluZGV4ICUgMiA9PT0gMCA/IFwiI2YyZjRmNFwiIDogXCJ3aGl0ZVwiIH19PlxuICAgICAgICAgICAgICAgIDx0ZD5cbiAgICAgICAgICAgICAgICAgIDxhXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT0nYXNzaWdubWVudC1saW5rJ1xuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICAgICAgICBuYXZpZ2F0ZVRvUGFnZShwYWdlLnVybCB8fCBwYWdlLnBhZ2VfaWQgfHwgcGFnZS5pZCk7XG4gICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIHtwYWdlLnRpdGxlfVxuICAgICAgICAgICAgICAgICAgPC9hPlxuICAgICAgICAgICAgICAgICAge3BhZ2UuZnJvbnRfcGFnZSAmJiAoXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuXG4gICAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcmdpbkxlZnQ6IFwiOHB4XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBmb250U2l6ZTogXCIxMXB4XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IFwiIzAwODQyY1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I6IFwiI2ZmZlwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGFkZGluZzogXCIycHggNnB4XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiMTBweFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgZm9udFdlaWdodDogXCJib2xkXCIsXG4gICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgIEZyb250IFBhZ2VcbiAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT17eyBtaW5XaWR0aDogXCJmaXQtY29udGVudFwiLCB3aGl0ZVNwYWNlOiBcIm5vd3JhcFwiIH19PlxuICAgICAgICAgICAgICAgICAge3BhZ2UuY3JlYXRlZF9hdFxuICAgICAgICAgICAgICAgICAgICA/IG5ldyBEYXRlKHBhZ2UuY3JlYXRlZF9hdCkudG9Mb2NhbGVEYXRlU3RyaW5nKFwiZW4tVVNcIiwgeyB5ZWFyOiBcIm51bWVyaWNcIiwgbW9udGg6IFwic2hvcnRcIiwgZGF5OiBcIm51bWVyaWNcIiB9KVxuICAgICAgICAgICAgICAgICAgICA6IFwiLVwifVxuICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgPHRkIHN0eWxlPXt7IG1pbldpZHRoOiBcImZpdC1jb250ZW50XCIsIHdoaXRlU3BhY2U6IFwibm93cmFwXCIgfX0+XG4gICAgICAgICAgICAgICAgICB7cGFnZS51cGRhdGVkX2F0XG4gICAgICAgICAgICAgICAgICAgID8gbmV3IERhdGUocGFnZS51cGRhdGVkX2F0KS50b0xvY2FsZURhdGVTdHJpbmcoXCJlbi1VU1wiLCB7IHllYXI6IFwibnVtZXJpY1wiLCBtb250aDogXCJzaG9ydFwiLCBkYXk6IFwibnVtZXJpY1wiIH0pXG4gICAgICAgICAgICAgICAgICAgIDogXCItXCJ9XG4gICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICkpfVxuICAgICAgICAgIDwvdGJvZHk+XG4gICAgICAgIDwvdGFibGU+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cbiIsIi8qKlxuICogUmVmb3JtYXRzIENhbnZhcyBkYXRlIHN0cmluZ3MgdG8gYSBtb3JlIHJlYWRhYmxlIGZvcm1hdFxuICogQHBhcmFtIHtzdHJpbmd9IGRhdGVTdHJpbmcgLSBUaGUgZGF0ZSBzdHJpbmcgdG8gcmVmb3JtYXRcbiAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSByZWZvcm1hdHRlZCBkYXRlIHN0cmluZ1xuICovXG5mdW5jdGlvbiBmaXhEYXRlRm9ybWF0KGRhdGVTdHJpbmcpIHtcbiAgLy9SZWZvcm1hdHMgQ2FudmFzIGRhdGUgc3RyaW5ncyB0byBhIG1vcmUgcmVhZGFibGUgZm9ybWF0XG4gIC8vIEV4YW1wbGUgaW5wdXQ6IDIwMjItMDgtMjlUMjI6MzA6MDBaXG4gIC8vIEV4YW1wbGUgb3V0cHV0OiBKdW4gNyBhdCAxMTo1OXBtXG4gIGlmICghZGF0ZVN0cmluZykgcmV0dXJuIFwiXCI7XG4gIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZShkYXRlU3RyaW5nKTtcbiAgY29uc3QgZGF0ZVBhcnQgPSBkYXRlLnRvTG9jYWxlRGF0ZVN0cmluZyhcImVuLVVTXCIsIHtcbiAgICBtb250aDogXCJzaG9ydFwiLFxuICAgIGRheTogXCJudW1lcmljXCIsXG4gIH0pO1xuICBjb25zdCB0aW1lUGFydCA9IGRhdGVcbiAgICAudG9Mb2NhbGVUaW1lU3RyaW5nKFwiZW4tVVNcIiwge1xuICAgICAgaG91cjogXCJudW1lcmljXCIsXG4gICAgICBtaW51dGU6IFwiMi1kaWdpdFwiLFxuICAgICAgaG91cjEyOiB0cnVlLFxuICAgIH0pXG4gICAgLnRvTG93ZXJDYXNlKClcbiAgICAucmVwbGFjZSgvXFxzKy9nLCBcIlwiKTsgLy8gQ29udmVydHMgXCIxMDozMCBQTVwiIC0+IFwiMTA6MzBwbVwiXG5cbiAgcmV0dXJuIGAke2RhdGVQYXJ0fSBhdCAke3RpbWVQYXJ0fWA7XG59XG5cbi8qKlxuICogRGV0ZWN0cyB0aGUgY3VycmVudCBleGVjdXRpb24gZW52aXJvbm1lbnQgb2YgdGhlIGFwcGxpY2F0aW9uLlxuICogQHJldHVybnMge3N0cmluZ30gVGhlIGN1cnJlbnQgZXhlY3V0aW9uIGVudmlyb25tZW50LlxuICovXG5mdW5jdGlvbiBnZXRBcHBDb250ZXh0KCkge1xuICBjb25zdCBwcm90b2NvbCA9IHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbDtcbiAgY29uc3QgaG9zdG5hbWUgPSB3aW5kb3cubG9jYXRpb24uaG9zdG5hbWU7XG5cbiAgLy8gMS4gTG9jYWwgSFRNTCBmaWxlIG9wZW5lZCBkaXJlY3RseSBmcm9tIHRoZSBoYXJkIGRyaXZlXG4gIGlmIChwcm90b2NvbCA9PT0gXCJmaWxlOlwiKSB7XG4gICAgcmV0dXJuIFwibG9jYWxfZmlsZVwiO1xuICB9XG5cbiAgLy8gMi4gUnVubmluZyBpbnNpZGUgYSBicm93c2VyIGV4dGVuc2lvbiAoQ2hyb21lLCBFZGdlLCBCcmF2ZSwgT3BlcmEsIEZpcmVmb3gpXG4gIGlmIChwcm90b2NvbCA9PT0gXCJjaHJvbWUtZXh0ZW5zaW9uOlwiIHx8IHByb3RvY29sID09PSBcIm1vei1leHRlbnNpb246XCIpIHtcbiAgICByZXR1cm4gXCJleHRlbnNpb25cIjtcbiAgfVxuXG4gIC8vIDMuIEhvc3RlZCBvbiBhIHdlYiBzZXJ2ZXJcbiAgaWYgKHByb3RvY29sID09PSBcImh0dHA6XCIgfHwgcHJvdG9jb2wgPT09IFwiaHR0cHM6XCIpIHtcbiAgICBpZiAoaG9zdG5hbWUgPT09IFwibG9jYWxob3N0XCIgfHwgaG9zdG5hbWUgPT09IFwiMTI3LjAuMC4xXCIpIHtcbiAgICAgIHJldHVybiBcImxvY2FsaG9zdFwiO1xuICAgIH1cbiAgICByZXR1cm4gXCJ3ZWJzaXRlXCI7XG4gIH1cblxuICByZXR1cm4gXCJ1bmtub3duXCI7XG59XG5cbi8qKiBSZXBsYWNlcyBjaGFyYWN0ZXJzIHRoYXQgYXJlIGludmFsaWQgb3IgcHJvYmxlbWF0aWMgaW4gZmlsZSBwYXRocy5cbiAqIFRha2VuIGZyb20gdGhlIGhlbHBlcnMuanMgZmlsZS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBmaWxlIHRvIHNhbml0aXplXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgc2FuaXRpemVkIGZpbGVuYW1lXG4gKi9cbmZ1bmN0aW9uIHNhbml0aXplRmlsZW5hbWUobmFtZSkge1xuICBpZiAoIW5hbWUpIHJldHVybiBcInVudGl0bGVkXCI7XG4gIGNvbnN0IGNsZWFuZWQgPSBuYW1lXG4gICAgLnJlcGxhY2UoL1tcXHUwMDAwLVxcdTAwMUZcXHUwMDdGXS9nLCBcIlwiKSAvLyBjb250cm9sIGNoYXJzXG4gICAgLnJlcGxhY2UoL1tcXHUyMDBCLVxcdTIwMERcXHVGRUZGXS9nLCBcIlwiKSAvLyB6ZXJvLXdpZHRoIGNoYXJzXG4gICAgLnJlcGxhY2UoL1xcdTAwQTAvZywgXCIgXCIpIC8vIG5vbi1icmVha2luZyBzcGFjZVxuICAgIC5yZXBsYWNlKC9bL1xcXFw/JSo6fFwiPD5dL2csIFwiLVwiKSAvLyBPUy1yZXNlcnZlZCBjaGFyc1xuICAgIC5yZXBsYWNlKC9eXFwuKy8sIFwiXCIpIC8vIGxlYWRpbmcgZG90c1xuICAgIC5yZXBsYWNlKC9bLiBdKyQvLCBcIlwiKSAvLyB0cmFpbGluZyBkb3RzL3NwYWNlc1xuICAgIC5yZXBsYWNlKC9eKENPTnxQUk58QVVYfE5VTHxDT01bMS05XXxMUFRbMS05XSkoXFwufCQpL2ksIFwiXyQxJDJcIikgLy8gV2luZG93cyByZXNlcnZlZCBuYW1lc1xuICAgIC50cmltKCk7XG4gIHJldHVybiBjbGVhbmVkIHx8IFwidW50aXRsZWRcIjtcbn1cblxuLyoqXG4gKiBEZXRlY3RzIHRoZSBtaW1lIGNsYXNzIG9mIGEgZmlsZSBvYmplY3QuXG4gKiBAcGFyYW0geyp9IGZpbGVPYmogLSBUaGUgZmlsZSBvYmplY3QgdG8gZGV0ZWN0IHRoZSBtaW1lIGNsYXNzIG9mLlxuICogQHJldHVybnMge3N0cmluZ30gVGhlIG1pbWUgY2xhc3Mgb2YgdGhlIGZpbGUgb2JqZWN0LlxuICovXG5mdW5jdGlvbiBnZXRNaW1lQ2xhc3MoZmlsZU9iaikge1xuICBpZiAoIWZpbGVPYmopIHJldHVybiBcInVua25vd25cIjtcbiAgaWYgKGZpbGVPYmoubWltZV9jbGFzcykgcmV0dXJuIGZpbGVPYmoubWltZV9jbGFzcztcbiAgY29uc3QgY29udGVudFR5cGUgPSAoZmlsZU9ialtcImNvbnRlbnQtdHlwZVwiXSB8fCBmaWxlT2JqLmNvbnRlbnRUeXBlIHx8IFwiXCIpLnRvTG93ZXJDYXNlKCk7XG4gIGNvbnN0IGZpbGVuYW1lID0gKGZpbGVPYmouZGlzcGxheV9uYW1lIHx8IGZpbGVPYmouZmlsZW5hbWUgfHwgXCJcIikudG9Mb3dlckNhc2UoKTtcblxuICBpZiAoY29udGVudFR5cGUuc3RhcnRzV2l0aChcImltYWdlL1wiKSB8fCAvXFwuKGpwZ3xqcGVnfHBuZ3xnaWZ8c3ZnfHdlYnB8Ym1wfGljbykkLy50ZXN0KGZpbGVuYW1lKSkgcmV0dXJuIFwiaW1hZ2VcIjtcbiAgaWYgKGNvbnRlbnRUeXBlLnN0YXJ0c1dpdGgoXCJ2aWRlby9cIikgfHwgL1xcLihtcDR8d2VibXxvZ2d8bW92fGF2aXxta3YpJC8udGVzdChmaWxlbmFtZSkpIHJldHVybiBcInZpZGVvXCI7XG4gIGlmIChjb250ZW50VHlwZSA9PT0gXCJhcHBsaWNhdGlvbi9wZGZcIiB8fCBmaWxlbmFtZS5lbmRzV2l0aChcIi5wZGZcIikpIHJldHVybiBcInBkZlwiO1xuICBpZiAoY29udGVudFR5cGUuc3RhcnRzV2l0aChcInRleHQvXCIpIHx8IC9cXC4odHh0fG1kfGNzdnxqc29ufGpzfHB5fGN8Y3BwfGNzc3x4bWwpJC8udGVzdChmaWxlbmFtZSkpIHJldHVybiBcInRleHRcIjtcbiAgaWYgKGNvbnRlbnRUeXBlLmluY2x1ZGVzKFwiaHRtbFwiKSB8fCAvXFwuKGh0bWx8aHRtKSQvLnRlc3QoZmlsZW5hbWUpKSByZXR1cm4gXCJodG1sXCI7XG4gIGlmIChjb250ZW50VHlwZS5pbmNsdWRlcyhcIndvcmRcIikgfHwgY29udGVudFR5cGUuaW5jbHVkZXMoXCJvZmZpY2Vkb2N1bWVudC53b3JkcHJvY2Vzc2luZ21sXCIpIHx8IC9cXC4oZG9jfGRvY3gpJC8udGVzdChmaWxlbmFtZSkpXG4gICAgcmV0dXJuIFwiZG9jXCI7XG4gIGlmIChjb250ZW50VHlwZS5pbmNsdWRlcyhcInBvd2VycG9pbnRcIikgfHwgY29udGVudFR5cGUuaW5jbHVkZXMoXCJvZmZpY2Vkb2N1bWVudC5wcmVzZW50YXRpb25tbFwiKSB8fCAvXFwuKHBwdHxwcHR4KSQvLnRlc3QoZmlsZW5hbWUpKVxuICAgIHJldHVybiBcInBwdFwiO1xuICBpZiAoY29udGVudFR5cGUuaW5jbHVkZXMoXCJleGNlbFwiKSB8fCBjb250ZW50VHlwZS5pbmNsdWRlcyhcIm9mZmljZWRvY3VtZW50LnNwcmVhZHNoZWV0bWxcIikgfHwgL1xcLih4bHN8eGxzeCkkLy50ZXN0KGZpbGVuYW1lKSkgcmV0dXJuIFwieGxzXCI7XG4gIHJldHVybiBcInVua25vd25cIjtcbn1cblxuLyoqXG4gKiBDYWxjdWxhdGVzIHRoZSBncmFkZSBmb3IgYSBzcGVjaWZpYyBhc3NpZ25tZW50IGdyb3VwLlxuICogQHBhcmFtIHsqfSBncm91cCAtIFRoZSBhc3NpZ25tZW50IGdyb3VwIHRvIGNhbGN1bGF0ZSB0aGUgZ3JhZGUgZm9yLlxuICogQHBhcmFtIHsqfSBhc3NpZ25tZW50cyAtIFRoZSBsaXN0IG9mIGFzc2lnbm1lbnRzLlxuICogQHJldHVybnMge09iamVjdH0gQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIHRvdGFsIHBvaW50cyBwb3NzaWJsZSwgdG90YWwgcG9pbnRzIGVhcm5lZCwgYW5kIHRoZSBwZXJjZW50YWdlIGZvciB0aGUgYXNzaWdubWVudCBncm91cC5cbiAqL1xuZnVuY3Rpb24gY2FsY3VsYXRlR3JhZGVGb3JHcm91cChncm91cCwgYXNzaWdubWVudHMpIHtcbiAgY29uc3QgZ3JvdXBBc3NpZ25tZW50cyA9IGFzc2lnbm1lbnRzLmZpbHRlcihcbiAgICAoYXNzaWdubWVudCkgPT5cbiAgICAgIGFzc2lnbm1lbnQuYXNzaWdubWVudF9ncm91cF9pZCA9PT0gZ3JvdXAuaWQgJiYgYXNzaWdubWVudC5zdWJtaXNzaW9uPy5ncmFkZSAhPSBudWxsICYmICFhc3NpZ25tZW50Lm9taXRfZnJvbV9maW5hbF9ncmFkZSxcbiAgKTtcblxuICBjb25zdCB0b3RhbFBvaW50c1Bvc3NpYmxlID0gZ3JvdXBBc3NpZ25tZW50cy5yZWR1Y2UoKHN1bSwgYXNzaWdubWVudCkgPT4gc3VtICsgKGFzc2lnbm1lbnQucG9pbnRzX3Bvc3NpYmxlIHx8IDApLCAwKTtcblxuICBjb25zdCB0b3RhbFBvaW50c0Vhcm5lZCA9IGdyb3VwQXNzaWdubWVudHMucmVkdWNlKChzdW0sIGFzc2lnbm1lbnQpID0+IHN1bSArIChhc3NpZ25tZW50LnN1Ym1pc3Npb24/LnNjb3JlIHx8IDApLCAwKTtcblxuICByZXR1cm4ge1xuICAgIHRvdGFsUG9pbnRzUG9zc2libGUsXG4gICAgdG90YWxQb2ludHNFYXJuZWQsXG4gICAgcGVyY2VudGFnZTogdG90YWxQb2ludHNQb3NzaWJsZSA+IDAgPyAodG90YWxQb2ludHNFYXJuZWQgLyB0b3RhbFBvaW50c1Bvc3NpYmxlKSAqIDEwMCA6IG51bGwsXG4gIH07XG59XG4vKipcbiAqIENhbGN1bGF0ZXMgdGhlIHRvdGFsIHdlaWdodGVkIGdyYWRlIGZvciBhbGwgYXNzaWdubWVudHMgaW4gYSBjb3Vyc2UuXG4gKiBAcGFyYW0geyp9IGFzc2lnbm1lbnRzIC0gVGhlIGxpc3Qgb2YgYXNzaWdubWVudHMuXG4gKiBAcGFyYW0geyp9IGFzc2lnbm1lbnRHcm91cHMgLSBUaGUgbGlzdCBvZiBhc3NpZ25tZW50IGdyb3Vwcy5cbiAqIEByZXR1cm5zIHtPYmplY3R9IEFuIG9iamVjdCBjb250YWluaW5nIHRoZSB0b3RhbCB3ZWlnaHRlZCBncmFkZSBmb3IgdGhlIGNvdXJzZS5cbiAqL1xuZnVuY3Rpb24gY2FsY3VsYXRlVG90YWxXZWlnaHRlZEdyYWRlKGFzc2lnbm1lbnRzLCBhc3NpZ25tZW50R3JvdXBzKSB7XG4gIGlmICghYXNzaWdubWVudEdyb3VwcyB8fCBhc3NpZ25tZW50R3JvdXBzLmxlbmd0aCA9PT0gMCkge1xuICAgIC8vIGNhbGN1bGF0ZSB0aGUgdG90YWwgZ3JhZGUgd2l0aG91dCB3ZWlnaHRpbmcgaWYgbm8gYXNzaWdubWVudCBncm91cHMgYXJlIHByb3ZpZGVkXG4gICAgY29uc3QgZ3JhZGVkQXNzaWdubWVudHMgPSBhc3NpZ25tZW50cy5maWx0ZXIoKGFzc2lnbm1lbnQpID0+IGFzc2lnbm1lbnQuc3VibWlzc2lvbj8uZ3JhZGUgIT0gbnVsbCAmJiAhYXNzaWdubWVudC5vbWl0X2Zyb21fZmluYWxfZ3JhZGUpO1xuICAgIGNvbnN0IHRvdGFsUG9pbnRzUG9zc2libGUgPSBncmFkZWRBc3NpZ25tZW50cy5yZWR1Y2UoKHN1bSwgYXNzaWdubWVudCkgPT4gc3VtICsgKGFzc2lnbm1lbnQucG9pbnRzX3Bvc3NpYmxlIHx8IDApLCAwKTtcbiAgICBjb25zdCB0b3RhbFBvaW50c0Vhcm5lZCA9IGdyYWRlZEFzc2lnbm1lbnRzLnJlZHVjZSgoc3VtLCBhc3NpZ25tZW50KSA9PiBzdW0gKyAoYXNzaWdubWVudC5zdWJtaXNzaW9uPy5zY29yZSB8fCAwKSwgMCk7XG4gICAgcmV0dXJuIHRvdGFsUG9pbnRzUG9zc2libGUgPiAwID8gKHRvdGFsUG9pbnRzRWFybmVkIC8gdG90YWxQb2ludHNQb3NzaWJsZSkgKiAxMDAgOiBudWxsO1xuICB9XG5cbiAgbGV0IHRvdGFsV2VpZ2h0ZWRTY29yZSA9IDA7XG4gIGxldCB0b3RhbFdlaWdodCA9IDA7XG5cbiAgYXNzaWdubWVudEdyb3Vwcy5mb3JFYWNoKChncm91cCkgPT4ge1xuICAgIGNvbnN0IGdyb3VwR3JhZGUgPSBjYWxjdWxhdGVHcmFkZUZvckdyb3VwKGdyb3VwLCBhc3NpZ25tZW50cyk7XG5cbiAgICBpZiAoZ3JvdXBHcmFkZS5wZXJjZW50YWdlICE9PSBudWxsKSB7XG4gICAgICB0b3RhbFdlaWdodGVkU2NvcmUgKz0gZ3JvdXBHcmFkZS5wZXJjZW50YWdlICogKGdyb3VwLmdyb3VwX3dlaWdodCAvIDEwMCk7XG4gICAgICB0b3RhbFdlaWdodCArPSBncm91cC5ncm91cF93ZWlnaHQ7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gdG90YWxXZWlnaHQgPiAwID8gKHRvdGFsV2VpZ2h0ZWRTY29yZSAvIHRvdGFsV2VpZ2h0KSAqIDEwMCA6IG51bGw7XG59XG4vKipcbiAqIENhbGN1bGF0ZXMgdGhlIHRvdGFsIHBvaW50cyBlYXJuZWQgYW5kIHBvc3NpYmxlIGFjcm9zcyBhbGwgYXNzaWdubWVudHMgcmVnYXJkbGVzcyBvZiB3ZWlnaHRpbmcuXG4gKiBAcGFyYW0ge0FycmF5fSBhc3NpZ25tZW50cyAtIFRoZSBsaXN0IG9mIGFzc2lnbm1lbnRzLlxuICogQHJldHVybnMge09iamVjdH0gQW4gb2JqZWN0IGNvbnRhaW5pbmcgdG90YWxQb2ludHNFYXJuZWQgYW5kIHRvdGFsUG9pbnRzUG9zc2libGUuXG4gKi9cbmZ1bmN0aW9uIGNhbGN1bGF0ZVRvdGFsUG9pbnRzKGFzc2lnbm1lbnRzKSB7XG4gIGNvbnN0IGdyYWRlZEFzc2lnbm1lbnRzID0gYXNzaWdubWVudHMuZmlsdGVyKChhc3NpZ25tZW50KSA9PiBhc3NpZ25tZW50LnN1Ym1pc3Npb24/LmdyYWRlICE9IG51bGwgJiYgIWFzc2lnbm1lbnQub21pdF9mcm9tX2ZpbmFsX2dyYWRlKTtcbiAgY29uc3QgdG90YWxQb2ludHNQb3NzaWJsZSA9IGdyYWRlZEFzc2lnbm1lbnRzLnJlZHVjZSgoc3VtLCBhc3NpZ25tZW50KSA9PiBzdW0gKyAoYXNzaWdubWVudC5wb2ludHNfcG9zc2libGUgfHwgMCksIDApO1xuICBjb25zdCB0b3RhbFBvaW50c0Vhcm5lZCA9IGdyYWRlZEFzc2lnbm1lbnRzLnJlZHVjZSgoc3VtLCBhc3NpZ25tZW50KSA9PiBzdW0gKyAoYXNzaWdubWVudC5zdWJtaXNzaW9uPy5zY29yZSB8fCAwKSwgMCk7XG5cbiAgcmV0dXJuIHtcbiAgICB0b3RhbFBvaW50c1Bvc3NpYmxlLFxuICAgIHRvdGFsUG9pbnRzRWFybmVkLFxuICB9O1xufVxuIl0sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxNQUFNO0VBQUUsYUFBYTtFQUFFLFVBQVU7RUFBRSxRQUFRO0VBQUU7QUFBVSxDQUFDLEdBQUcsS0FBSztBQUVoRSxNQUFNLGFBQWEsR0FBRyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRXZDO0FBQ0EsTUFBTTtFQUFFLEdBQUc7RUFBRSxHQUFHO0VBQUU7QUFBSSxDQUFDLEdBQUcsU0FBUzs7QUFFbkM7QUFDQTtBQUNBOztBQUVBO0FBQ0EsZUFBZSxnQkFBZ0IsQ0FBQyxlQUFlLEVBQUUsSUFBSSxHQUFHLE1BQU0sRUFBRTtFQUM5RCxNQUFNLE9BQU8sR0FBRztJQUFFO0VBQUssQ0FBQzs7RUFFeEI7RUFDQSxJQUFJLENBQUMsTUFBTSxlQUFlLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxNQUFNLFNBQVMsRUFBRTtJQUNsRSxPQUFPLElBQUk7RUFDYjs7RUFFQTtFQUNBLElBQUksQ0FBQyxNQUFNLGVBQWUsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsTUFBTSxTQUFTLEVBQUU7SUFDcEUsT0FBTyxJQUFJO0VBQ2I7RUFFQSxPQUFPLEtBQUs7QUFDZDtBQUVBLFNBQVMscUJBQXFCLENBQUM7RUFBRTtBQUFTLENBQUMsRUFBRTtFQUMzQyxNQUFNLENBQUMsVUFBVSxFQUFFLGFBQWEsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUM7RUFDbEQsTUFBTSxDQUFDLFNBQVMsRUFBRSxZQUFZLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDO0VBQ2hELE1BQU0sQ0FBQyxZQUFZLEVBQUUsZUFBZSxDQUFDLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7O0VBRXhE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
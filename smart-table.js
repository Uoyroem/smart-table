(function () {
  const defaultNumberFormat = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

  function getFilename(response) {
    const contentDisposition = response.headers.get("Content-Disposition");
    if (!contentDisposition) {
      return "";
    }
    filename = contentDisposition.split(/;(.+)/)[1].split(/=(.+)/)[1];
    if (filename.toLowerCase().startsWith("utf-8''")) {
      filename = decodeURIComponent(filename.replace(/utf-8''/i, ""));
    } else {
      filename = filename.replace(/['"]/g, "");
    }
    return filename;
  }

  $.fn.smartTableUpdateSubtotals = function (fields = null) {
    $(this).trigger("st.reload.subtotals", [fields]);
  };

  $.fn.smartTableReload = function (reloadType = null) {
    $(this).trigger("st.reload.rows", [reloadType]);
  };

  $.fn.smartTableGetFilters = function (getFiltersFunction) {
    $(this).trigger("st.get.filters", [getFiltersFunction]);
  };
  $.fn.smartTableLoadFilters = function (filters, withReload = true) {
    $(this).trigger("st.load.filters", [filters, withReload]);
  };

  $.fn.smartTableResetFilters = function (withReload = false) {
    $(this).trigger("st.reset.filters", [withReload]);
  };

  $.fn.smartTableUpdateFieldValues = function (
    excludeOrInclude,
    field,
    values
  ) {
    $(this).trigger("st.update.fieldvalues", [excludeOrInclude, field, values]);
  };

  $.fn.smartTable = function (options) {
    const $smartTable = this;
    let reloading = false;
    async function reload(options = { type: null, force: false }) {
      if (reloading) {
        return;
      }

      reloading = true;
      $reloadButton.prop("disabled", true);
      $reloadButton.find(".fa-solid").addClass("fa-spin");
      if (options.type) {
        switch (options.type) {
          case "intersected":
            await new Promise((resolve, reject) => {
              const observer = new IntersectionObserver(function (
                entries,
                observer
              ) {
                if (entries[0].isIntersecting) {
                  showRows(options.force).then(resolve);
                  observer.disconnect();
                }
              });
              observer.observe($smartTable[0]);
            });
            break;
          case "immediately":
            await showRows(options.force);
            break;
        }
      } else {
        await showRows(options.force);
      }
      $reloadButton.find(".fa-solid").removeClass("fa-spin");
      $reloadButton.prop("disabled", false);
      reloading = false;
    }
    $smartTable.on("st.reload.rows", function (event, reloadType) {
      reload({ type: reloadType, force: true });
    });
    $smartTable.on("st.reload.subtotals", function () {
      updateSubtotals();
    });
    const smartTableId = `smart-table-${options.name}`;
    $smartTable.addClass(smartTableId);
    $smartTable.addClass("smart-table");
    function setValue(key, value) {
      if (options.setValue) {
        options.setValue(key, value);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    }

    function getValue(key) {
      if (options.getValue) {
        return options.getValue(key);
      } else {
        return JSON.parse(localStorage.getItem(key));
      }
    }
    function getTypeFromTh(th) {
      let type = $(th).data("stType");
      if (!type) {
        type = "string";
        $(th).data("stType", type);
      }
      return type;
    }
    function getTypeByField(field) {
      return getTypeFromTh($ths.filter(`[data-st-field="${field}"]`));
    }
    const $style = $("<style></style>").appendTo($smartTable);
    const styleSheet = $style.prop("sheet");
    const fields = [];
    const $ths = $(
      `thead th[data-st-field]:not([data-st-field=""])`,
      $smartTable
    );
    $ths.each(function () {
      const field = $(this).data("stField");
      fields.push(field);
      styleSheet.insertRule(`
        .${smartTableId}:has( thead th[data-st-field="${field}"]:nth-child(${$(this).index() + 1}).active) :where(th:not([data-st-field="${field}"]), td):nth-child(${$(this).index() + 1}) {
          display: table-cell;
        }
      `);
    });

    $ths.removeClass("active");
    const activeColumnsKey = `${smartTableId}-activeColumns`;
    let activeColumns = getValue(activeColumnsKey);
    if (activeColumns) {
      for (const [index, field] of Object.entries(activeColumns)) {
        $(
          `th[data-st-field="${field}"]:nth-child(${parseInt(index) + 1})`,
          $smartTable
        ).addClass("active");
      }
    } else {
      activeColumns = Array.from($ths).reduce(
        (activeColumns, th) => (
          (activeColumns[$(th).index()] = $(th).data("stField")), activeColumns
        ),
        {}
      );
      $ths.addClass("active");
      setValue(activeColumnsKey, activeColumns);
    }
    const $settings = $(`
      <div class="dropdown smart-table__settings">
        <button class="btn btn-sm" title="Настройки таблицы - сброс фильтра, показать/скрыть столбец и т.п." data-bs-auto-close="outside" type="button" data-bs-toggle="dropdown" aria-expanded="false">
          <i class="fa-solid fa-gears"></i>
        </button>
        <ul class="dropdown-menu">
          <li>
            <button type="button" class="btn dropdown-item smart-table__reset-button">Сбросить фильтр</button>
          </li>
          <li>
            <div class="btn-group dropend w-100">
              <button type="button" class="btn dropdown-item dropdown-toggle" data-bs-auto-close="outside" data-bs-toggle="dropdown" aria-expanded="false">
                Показать или скрыть столбцы
              </button>
              <ul class="dropdown-menu">
                <div class="smart-table__column-toggle-checkboxes mx-1 px-1"></div>
              </ul>
            </div>
          </li>
        </ul>
      </div>
    `);
    const $reloadButton = $(`
      <button type="button" title="Обновить таблицу" class="btn btn-sm smart-table__reload-button">
        <i class="fa-solid fa-sync"></i>
      </button>
    `);
    const $unload = $(`
      <div class="d-flex gap-1">
        <div class="dropdown smart-table__unload">
          <button class="btn btn-sm dropdown-toggle smart-table__unload-button" type="button" title="Выгрузить данные из таблицы в виде файла" data-bs-toggle="dropdown" aria-expanded="false">
            <i class="fa-solid fa-upload"></i>
          </button>
          <ul class="dropdown-menu smart-table__unload-types">
          </ul>
        </div>
        <button class="btn btn-sm text-danger smart-table__unload-cancel-button d-none">
          Отмена
        </button>
      </div>
    `);
    const $unloadButton = $unload.find(".smart-table__unload-button");
    const $unloadCancelButton = $unload.find(
      ".smart-table__unload-cancel-button"
    );

    const $toolsContainer = $(`
      <div class="d-flex align-items-center mb-1 gap-2">
      </div>
    `);
    $toolsContainer.append($settings);
    if (!("canReload" in options) || options.canReload) {
      $toolsContainer.append($reloadButton);
    }
    if (options.unloadTypes && options.unloadUrl) {
      let unloadAbortController = null;
      let unloading = false;
      async function unload(type) {
        if (unloading) {
          return;
        }
        unloading = true;
        $unloadButton.prop("disabled", true);
        $unloadButton.find(".fa-solid").addClass("fa-fade");
        $unloadCancelButton.removeClass("d-none");
        unloadAbortController = new AbortController();
        const fieldType = getFieldType();
        try {
          const response = await fetch(options.unloadUrl, {
            method: "POST",
            body: JSON.stringify({
              order,
              fieldValuesList,
              fieldType,
              type,
            }),
            headers: {
              "X-CSRFToken": options.csrfToken,
            },
            signal: unloadAbortController.signal,
          });
          console.log(response);
          if (response.ok) {
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            document.body.appendChild(a);
            a.href = objectUrl;
            a.download = getFilename(response);
            a.click();
            a.remove();
            URL.revokeObjectURL(objectUrl);
          }
        } catch (error) {
          console.error(error);
        }
        unloadAbortController = null;
        $unloadButton.find(".fa-solid").removeClass("fa-fade");
        $unloadCancelButton.addClass("d-none");
        $unloadButton.prop("disabled", false);
        unloading = false;
      }
      const $unloadTypes = $(".smart-table__unload-types", $unload);
      $unloadCancelButton.on("click", function () {
        if (unloadAbortController == null) {
          return;
        }
        try {
          unloadAbortController.abort();
        } catch (error) {
          console.log(error);
        }
      });
      $unloadTypes.on("click", ".smart-table__unload-type", function () {
        const type = $(this).data("stUnloadType");
        unload(type);
      });
      for (const unloadType of options.unloadTypes) {
        $unloadTypes.append(`
          <li>
            <button class="dropdown-item btn btn-sm smart-table__unload-type" data-st-unload-type="${unloadType.type}">${unloadType.html}</button>
          </li>
        `);
      }
      $toolsContainer.append($unload);
    }
    if ("addTools" in options && typeof options.addTools === "function") {
      try {
        options.addTools($toolsContainer);
      } catch (error) {
        console.error(error);
      }
    }
    $smartTable.before($toolsContainer);
    const $columnToggleCheckboxes = $(
      ".smart-table__column-toggle-checkboxes",
      $settings
    );
    async function resetFilters(withReload = true) {
      fieldValuesList = [];
      showFieldValuesPositions();
      resetOrder();
      if (withReload) {
        await reload({ force: true });
      }
      $settings.dropdown("hide");
    }
    $(".smart-table__reset-button", $settings).on("click", resetFilters);

    $smartTable.on("st.reset.filters", async function (event, withReload) {
      resetFilters(withReload);
    });
    $smartTable.on(
      "st.get.filters",
      async function (event, getFiltersFunction) {
        if (
          getFiltersFunction == null ||
          typeof getFiltersFunction !== "function"
        ) {
          throw new Error("specify getFiltersFunction");
        }
        try {
          getFiltersFunction({ fieldValuesList, order, fieldType: getFieldType() });
        } catch (error) {
          console.error(error);
          throw new Error(`Error on getting filters: ${error}`);
        }
      }
    );
    $smartTable.on("st.load.filters", function (event, filters, withReload) {
      fieldValuesList = filters.fieldValuesList;
      order = filters.order;
      if (withReload) {
        reload({type: options.firstShowRows, force: true});
      }
    });
    $ths.each(function () {
      const field = $(this).data("stField");
      const $th = $(this);
      const id = `${field}-toggle-checkbox`;
      const checkbox = $(`
        <div class="form-check form-switch">
          <input class="form-check-input smart-table__column-toggle-checkbox" type="checkbox" role="switch" id="${id}">
          <label class="form-check-label" for="${id}">${$(this)
        .text()
        .trim()}</label>
        </div>
      `)
        .find(".smart-table__column-toggle-checkbox")
        .on("change", function () {
          const checked = $(this).prop("checked");
          const checkboxes = $(
            ".smart-table__column-toggle-checkbox:checked",
            $settings
          );
          checkboxes.prop("disabled", checkboxes.length === 1);
          if (checked) {
            activeColumns[$th.index()] = field;
          } else {
            delete activeColumns[$th.index()];
          }
          setValue(activeColumnsKey, activeColumns);
          $th.toggleClass("active", checked);
        })
        .end();
      if (activeColumns[$th.index()] == field) {
        checkbox.find("input").prop("checked", true);
      }
      $columnToggleCheckboxes.append(checkbox);
    });
    $reloadButton.on("click", async function () {
      await reload({ force: true });
    });
    $ths.each(function () {
      $(this).html(`
        <div class="d-flex justify-content-between align-items-center">
          <div class="smart-table__th-content-container">
            ${$(this).html()}
          </div>
          <div class="smart-table__menu-toggle-button-container">
            <button class="smart-table__menu-toggle-button btn btn-sm text-black" type="button">
              <i class="fa-solid fa-caret-down"></i>
            </button>
          </div>
        </div>
      `);
    });
    const $menu = $(`
      <ul class="smart-table__menu dropdown-menu">
        <li class="mb-2">
          <button type="button" class="btn dropdown-item smart-table__menu-sort-button">
            <div class="row">
              <div class="col-1">
                <span class="smart-table__menu-sort-order text-primary-emphasis fw-bold">
                </span>
                <span class="smart-table__menu-sort-button-icon">
                  <i class="fa-solid fa-sort"></i>
                </span>
              </div>
              <div class="col-11">
                Сортировать
              </div>
            </div>
          </button>
        </li>
        <li>
          <div class="mx-2">
            <button type="button" class="btn btn-sm btn-link smart-table__menu-value-check-all">
              Выделить все
            </button>
            <button type="button" class="btn btn-sm btn-link smart-table__menu-value-uncheck-all">
              Сбросить
            </button>
            <div class="position-relative mb-2">
              <form class="smart-table__menu-value-search-form">
                <input type="search" class="form-control smart-table__menu-value-search-input pe-5"/>
              </form>
              
                
              <i class="position-absolute fa-solid fa-magnifying-glass" style="top: 30%; right: 5%"></i>
            
            </div>
            
            <ul class="list-group list-group-flush smart-table__menu-value-checkboxes border rounded">
              
            </ul>
          </div>
        </li>
        <li><hr class="dropdown-divider"></li>
        <li>
          <div class="text-end mx-2">
            <button type="button" class="btn btn-sm btn-outline-primary cancel-button">
              Отмена
            </button>
            <button type="button" class="btn btn-sm btn-primary submit-button">
              Принять
            </button>
          </div>
        </li>
      </ul>
    `);
    $menu.appendTo(document.body);
    let menuActive = false;

    let activeMenuToggleButton = null;
    $smartTable.on(
      "click",
      ".smart-table__menu-toggle-button",
      async function (event) {
        event.stopPropagation();
        if (activeMenuToggleButton != null && activeMenuToggleButton === this) {
          hideMenu.call(this);
        } else if (menuActive) {
          hideMenu.call(this);
          showMenu.call(this);
        } else {
          showMenu.call(this);
        }
      }
    );
    function showMenu() {
      menuActive = true;
      activeMenuToggleButton = this;
      const offset = $(this).offset();
      offset.top += $(this).outerHeight() + 2;
      console.log(window.innerWidth, offset.left + $menu.outerWidth());
      if (offset.left + $menu.outerWidth() > window.innerWidth) {
        offset.left -= $menu.outerWidth() - $(this).outerWidth();
      }
      $menu.css(offset);
      $menu.addClass("show");
      onMenuShown.call(this);
    }
    function hideMenu() {
      menuActive = false;
      activeMenuToggleButton = null;
      $menu.removeClass("show");
      onMenuHidden.call(this);
    }
    $(document).on("click", function () {
      hideMenu();
    });
    $menu.on("click", function (event) {
      event.stopPropagation();
    });

    let $activeTh = null;
    function getSearchQueryValueCheckboxes(shouldMatchSearchQuery = true) {
      const searchQuery = $(
        ".smart-table__menu-value-search-input",
        $menu
      ).val();
      return $(".smart-table__menu-value-checkbox", $menu).filter(function () {
        const isMatched = `${indexValue[$(this).val()]}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        return shouldMatchSearchQuery ? isMatched : !isMatched;
      });
    }

    function showSearchQueryResults() {
      const matchedCheckboxes = getSearchQueryValueCheckboxes();
      $(".smart-table__menu-empty-value").toggleClass(
        "d-none",
        matchedCheckboxes.length !== 0
      );
      matchedCheckboxes.closest(".list-group-item").removeClass("d-none");
      getSearchQueryValueCheckboxes(false)
        .closest(".list-group-item")
        .addClass("d-none");
    }

    $menu.on("input", ".smart-table__menu-value-search-input", function () {
      showSearchQueryResults();
    });

    $menu.on(
      "submit",
      ".smart-table__menu-value-search-form",
      function (event) {
        event.preventDefault();
        getSearchQueryValueCheckboxes().prop("checked", true);
        getSearchQueryValueCheckboxes(false).prop("checked", false);
        submit();
      }
    );

    let fieldValuesList = [];
    let indexValue = {};
    function onMenuHidden() {
      const $menuValueCheckboxes = $(
        ".smart-table__menu-value-checkboxes",
        $menu
      );
      $menuValueCheckboxes.empty();
      newOrder = null;
      if ($activeTh) {
        $activeTh.data("newSort", null);
        $activeTh = null;
      }
    }
    async function onMenuShown() {
      menuActive = true;
      $activeTh = $(this).closest("th");
      console.log($activeTh);
      newOrder = JSON.parse(JSON.stringify(order));
      const $menuSearchInput = $(
        ".smart-table__menu-value-search-input",
        $menu
      );
      $menuSearchInput.val(null);
      $activeTh.data("newSort", $activeTh.data("sort"));
      changeSortIcon();
      changeOrder();
      const $menuValueCheckboxes = $(
        ".smart-table__menu-value-checkboxes",
        $menu
      );
      $menuValueCheckboxes.html(`
        <li class="list-group-item text-center">
          <div class="spinner-border spinner-border-sm text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </li>
      `);
      const field = $activeTh.data("stField");
      const type = getTypeFromTh($activeTh);
      const fieldType = getFieldType();
      let values = await options.getValues(field, fieldType, fieldValuesList);
      values = Array.from(
        new Set(
          Array.from(values).map(function (value) {
            switch (type) {
              case "number":
                return parseFloat(value);
              case "date":
                const date = new Date(value);
                return date.toISOString().slice(0, 10);
              default:
                return value;
            }
          })
        )
      );
      values.sort(function (a, b) {
        if (a == null || b == null) {
          return 0;
        }
        switch (type) {
          case "number":
            return b - a;
          case "date":
            return new Date(b) - new Date(a);
          default:
            return options.collator
              ? options.collator.compare(b, a)
              : b.toString().localeCompare(a.toString());
        }
      });
      $menuValueCheckboxes.empty();
      let index = 0;
      let hasEmptyCheckbox = false;
      for (let value of values) {
        if (value == null) {
          if (hasEmptyCheckbox) {
            continue;
          }
          indexValue[""] = "";
          $menuValueCheckboxes.prepend(`
            <li class="list-group-item">
              <div class="form-check">
                <input class="form-check-input smart-table__menu-value-checkbox" type="checkbox" value="" id="empty-checkbox" checked>
                <label class="form-check-label" for="empty-checkbox">
                  (Пустые)
                </label>
              </div>
            </li>
          `);
          hasEmptyCheckbox = true;
        } else {
          indexValue[index] = value;
          const id = `checkbox-${index}`;
          $menuValueCheckboxes.append(`
            <li class="list-group-item">
              <div class="form-check">
                <input class="form-check-input smart-table__menu-value-checkbox" type="checkbox" value="${index}" id="${id}" checked>
                <label class="form-check-label" for="${id}">
                  ${formatValue(value, type)}
                </label>
              </div>
            </li>
          `);
          index++;
        }
      }
      const fieldValues = fieldValuesList.find(
        (fieldValues) => fieldValues.field === field
      );
      if (fieldValues) {
        $(".smart-table__menu-value-checkbox", $menu).each(function () {
          $(this).prop(
            "checked",
            fieldValues.exclude.length === 0
              ? fieldValues.include.includes(indexValue[$(this).val()])
              : !fieldValues.exclude.includes(indexValue[$(this).val()])
          );
        });
      }
      $menuValueCheckboxes.append(`
        <li class="list-group-item smart-table__menu-empty-value d-none text-center">
          Ничего не найдено
        </li>
      `);
      showSearchQueryResults();
    }

    function formatValue(value, type) {
      switch (type) {
        case "number":
          return (options.numberFormat || defaultNumberFormat).format(
            parseFloat(value) || 0
          );
        default:
          return value;
      }
    }

    async function updateSubtotals(fields = null) {
      if (options.getSubtotals) {
        const fieldSubtotal = getFieldSubtotal(fields);
        const fieldType = getFieldType(fields);
        try {
          const fieldResult = await options.getSubtotals(
            fieldValuesList,
            fieldType,
            fieldSubtotal
          );
          $ths.each(function () {
            const field = $(this).data("stField");
            const type = getTypeFromTh(this);
            const $subtotal = getThSubtotal(this);
            if ($subtotal.length === 0) {
              return;
            }
            const subtotal = $subtotal.data("stSubtotal");
            if (!subtotal) {
              return;
            }
            let result = fieldResult[field];
            if (subtotal == 9) {
              result = formatValue(result, type);
            }
            $subtotal.html(result);
          });
        } catch (error) {
          console.error(error);
        }
      }
    }

    function changeSortIcon() {
      const $menuButtonSortIcon = $(
        ".smart-table__menu-sort-button-icon",
        $menu
      );
      const sort = $activeTh.data("newSort");
      if (!sort) {
        $menuButtonSortIcon.html(`<i class="fa-solid fa-sort"></i>`);
      } else if (sort === "asc") {
        $menuButtonSortIcon.html(`<i class="fa-solid fa-sort-up"></i>`);
      } else {
        $menuButtonSortIcon.html(`<i class="fa-solid fa-sort-down"></i>`);
      }
    }
    let order;
    function resetOrder() {
      order = JSON.parse(JSON.stringify(options.defaultOrder || []));
      $("thead th", $smartTable).data("sort", null);
      for (const fieldSort of order) {
        const th = $(`thead th[data-st-field="${fieldSort.field}"]`);
        fieldSort["type"] = getTypeFromTh(th);
        th.data("sort", fieldSort.sort);
      }
    }
    resetOrder();
    let newOrder = null;
    function changeOrder() {
      const field = $activeTh.data("stField");
      const type = getTypeFromTh($activeTh);
      const sort = $activeTh.data("newSort");
      const fieldSort = newOrder.find((fieldSort) => fieldSort.field == field);
      let index = null;
      if (fieldSort) {
        index = newOrder.indexOf(fieldSort);
        if (sort) {
          fieldSort.sort = sort;
        } else {
          newOrder.splice(index, 1);
          index = null;
        }
      } else if (sort) {
        index = newOrder.length;
        newOrder.push({
          field,
          type,
          sort,
        });
      }
      const $menuButtonSortOrder = $(".smart-table__menu-sort-order", $menu);
      $menuButtonSortOrder.html(index != null ? index + 1 : "");
    }
    $menu.on("click", ".smart-table__menu-sort-button", function () {
      const sort = $activeTh.data("newSort");
      if (!sort) {
        $activeTh.data("newSort", "asc");
      } else if (sort === "asc") {
        $activeTh.data("newSort", "desc");
      } else {
        $activeTh.data("newSort", null);
      }
      changeSortIcon();
      changeOrder();
    });

    $menu.on("click", ".cancel-button", function () {
      hideMenu();
    });

    function getThSubtotal(th) {
      return $(
        `thead th[data-st-subtotal]:nth-child(${$(th).index() + 1})`,
        $smartTable
      );
    }

    function getFieldSubtotal(fields = null) {
      const fieldSubtotal = {};
      $ths.each(async function () {
        const field = $(this).data("stField");
        if (fields && fields.includes(fields)) {
          return;
        }
        const $subtotalTh = getThSubtotal(this);
        if ($subtotalTh.length === 0) {
          return;
        }
        const subtotal = $subtotalTh.data("stSubtotal");
        if (!subtotal) {
          return;
        }
        fieldSubtotal[field] = subtotal;
      });
      return fieldSubtotal;
    }

    function getFieldType(fields = null) {
      const fieldType = {};
      $ths.each(function () {
        const field = $(this).data("stField");
        const type = getTypeFromTh(this);
        if (fields && fields.includes(field)) {
          return;
        }
        fieldType[field] = type;
      });
      return fieldType;
    }

    async function showRows(forceReload = false) {
      const fieldType = getFieldType();
      try {
        await options.showRows(fieldValuesList, fieldType, order, forceReload);
        $smartTable.trigger("st.rows.displayed");
      } catch (error) {
        console.error(error);
      }
      updateSubtotals();
    }

    async function submit() {
      $activeTh.data("sort", $activeTh.data("newSort"));
      order = newOrder;
      const field = $activeTh.data("stField");
      const type = $activeTh.data("stType");
      const matchedCheckboxes = $(
        ".smart-table__menu-value-checkbox:checked",
        $menu
      );
      const unmatchedCheckboxes = $(
        ".smart-table__menu-value-checkbox:not(:checked)",
        $menu
      );
      const fieldValues = fieldValuesList.find(
        (fieldValues) => fieldValues.field === field
      );
      if (unmatchedCheckboxes.length === 0) {
        if (fieldValues) {
          fieldValuesList.splice(fieldValuesList.indexOf(fieldValues), 1);
        }
      } else if (unmatchedCheckboxes.length > matchedCheckboxes.length) {
        const include = Array.from(matchedCheckboxes).map(
          (matchedCheckbox) => indexValue[$(matchedCheckbox).val()]
        );
        if (fieldValues) {
          fieldValues.include = include;
          fieldValues.exclude = [];
        } else {
          fieldValuesList.push({
            field,
            type,
            include,
            exclude: [],
          });
        }
      } else {
        const exclude = Array.from(unmatchedCheckboxes).map(
          (unmatchedCheckbox) => indexValue[$(unmatchedCheckbox).val()]
        );
        if (fieldValues) {
          fieldValues.include = [];
          fieldValues.exclude = exclude;
        } else {
          fieldValuesList.push({
            field,
            type,
            include: [],
            exclude,
          });
        }
      }
      showFieldValuesPositions();
      await reload();
      hideMenu();
    }

    function showFieldValuesPositions() {
      $ths
        .find(".smart-table__menu-toggle-button")
        .html(`<i class="fa-solid fa-caret-down"></i>`);

      let index = 1;
      for (const fieldValues of fieldValuesList) {
        $ths
          .filter(`[data-st-field="${fieldValues.field}"]`)
          .find(".smart-table__menu-toggle-button").html(`
          <div class="d-flex align-items-center text-danger">
            <i class="fa-solid fa-filter"></i>
            <span class="fw-bold">${index}</span> 
          </div>
        `);
        index++;
      }
    }

    $menu.on("click", ".submit-button", submit);
    $smartTable.on(
      "st.update.fieldvalues",
      async function (event, excludeOrInclude, field, values) {
        if (!["exclude", "include"].includes(excludeOrInclude)) {
          throw Error("include or exclude");
        }
        const fieldValues = fieldValuesList.find(
          (fieldValues) => fieldValues.field === field
        );
        if (fieldValues) {
          fieldValues[excludeOrInclude] = values;
          fieldValues[excludeOrInclude === "include" ? "exclude" : "include"] =
            [];
        } else {
          fieldValuesList.push({
            field,
            type: getTypeByField(field),
            [excludeOrInclude]: values,
            [excludeOrInclude === "include" ? "exclude" : "include"]: [],
          });
        }
        showFieldValuesPositions();
      }
    );

    $menu.on("click", ".smart-table__menu-value-check-all", function () {
      getSearchQueryValueCheckboxes().prop("checked", true);
    });

    $menu.on("click", ".smart-table__menu-value-uncheck-all", function () {
      getSearchQueryValueCheckboxes().prop("checked", false);
    });
    reload({ type: options.firstShowRows, force: true });
  };

  $.fn.smartTableWithVirtualScroll = function (options) {
    if (!options.rowsTarget) {
      console.error(`Specify "rowsTarget" in options for`, this);
      return;
    }
    const $rows = $(options.rowsTarget);
    if ($rows.length === 0) {
      console.error(
        `Rows element with selector "${options.rowsTarget}" missing, specify a valid selector in options for`,
        this
      );
      return;
    }
    if (!options.lastRowTarget) {
      console.error(`Specify "lastRowTarget" in options for`, this);
      return;
    }
    const $lastRow = $(options.lastRowTarget);
    if ($lastRow.length === 0) {
      console.error(
        `Last row element with selector "${options.lastRowTarget}" missing, specify a valid selector in options for`,
        this
      );
      return;
    }

    this.smartTable({
      async getValues(field, fieldType, fieldValuesList) {
        const response = await fetch(options.getValuesUrl, {
          method: "POST",
          body: JSON.stringify({
            field,
            fieldType,
            fieldValuesList,
          }),
          headers: {
            "X-CSRFToken": options.csrfToken,
          },
        });
        const data = await response.json();
        return data.values;
      },
      reset() {
        this.next = options.getRowsUrl;
      },
      async getRows(fieldValuesList, fieldType, order) {
        if (this.next) {
          const response = await fetch(this.next, {
            method: "POST",
            body: JSON.stringify({
              fieldValuesList,
              fieldType,
              order,
            }),
            headers: {
              "X-CSRFToken": options.csrfToken,
            },
          });
          const data = await response.json();
          this.next = data.next;
          return data.rows;
        }
        return null;
      },
      async insertRows(fieldValuesList, fieldType, order) {
        const $loadingTr = $lastRow.before(options.loadingHtml).prev();
        const rows = await this.getRows(fieldValuesList, fieldType, order);
        $loadingTr.remove();
        if (rows) {
          for (const row of rows) {
            $lastRow.before(options.getTr(row));
          }
        }
      },
      async showRows(fieldValuesList, fieldType, order) {
        if (this.observer) {
          this.observer.unobserve($(options.lastRowTarget)[0]);
        }
        $("tr", $rows).not($lastRow).remove();
        const observer = new IntersectionObserver(async (entries, observer) => {
          if (entries[0].isIntersecting) {
            observer.unobserve($(options.lastRowTarget)[0]);
            await this.insertRows(fieldValuesList, fieldType, order);
            observer.observe($(options.lastRowTarget)[0]);
          }
        });
        this.observer = observer;
        this.reset();
        await this.insertRows(fieldValuesList, fieldType, order);
        observer.observe($(options.lastRowTarget)[0]);
      },
      async getSubtotals(fieldValuesList, fieldType, fieldSubtotal) {
        const response = await fetch(this.getSubtotalsUrl, {
          method: "POST",
          body: JSON.stringify({
            fieldValuesList,
            fieldType,
            fieldSubtotal,
          }),
          headers: {
            "X-CSRFToken": options.csrfToken,
          },
        });
        const json = await response.json();
        return json.fieldResult;
      },
      ...options,
    });
  };
})();

function smartTableParseValue(value, type) {
  switch (type) {
    case "boolean":
      return typeof value === "string" ? value === "true" : !!value;
  }
  return value;
}

function smartTableConvert(rows, fieldType) {
  return JSON.parse(JSON.stringify(rows)).map((row) => {
    for (const [field, type] of Object.entries(fieldType)) {
      row[field] = smartTableParseValue(row[field], type);
    }
    return row;
  });
}

function smartTableFilterRows(rows, fieldValuesList, field = null) {
  if (!rows || rows.length === 0) {
    return [];
  }
  let filteredRows = JSON.parse(JSON.stringify(rows));
  for (const fieldValues of fieldValuesList) {
    if (fieldValues.field == field) {
      break;
    }
    filteredRows = filteredRows.filter((row) => {
      const value = row[fieldValues.field];
      return fieldValues.exclude.length === 0
        ? value == null
          ? fieldValues.include.includes("")
          : fieldValues.include.some(
              (item) => smartTableParseValue(item, fieldValues.type) == value
            )
        : value == null
        ? !fieldValues.exclude.includes("")
        : !fieldValues.exclude.some(
            (item) => smartTableParseValue(item, fieldValues.type) == value
          );
    });
  }
  return filteredRows;
}

function smartTableGetRows(rows, fieldValuesList, fieldType, order) {
  if (!rows || rows.length === 0) {
    return [];
  }
  return smartTableOrderRows(
    smartTableFilterRows(smartTableConvert(rows, fieldType), fieldValuesList),
    order
  );
}

function smartTableGetValues(rows, field, fieldType, fieldValuesList) {
  if (!rows || rows.length === 0) {
    return [];
  }
  return smartTableFilterRows(
    smartTableConvert(rows, fieldType),
    fieldValuesList,
    field
  ).map((row) => row[field]);
}

function smartTableGetSubtotals(
  rows,
  fieldValuesList,
  fieldType,
  fieldSubtotal
) {
  if (!rows || rows.length === 0) {
    return 0;
  }
  rows = smartTableFilterRows(
    smartTableConvert(rows, fieldType),
    fieldValuesList
  );
  const fieldResult = {};
  for (const [field, subtotal] of Object.entries(fieldSubtotal)) {
    switch (subtotal) {
      case 2:
        fieldResult[field] = rows.filter((row) => row[field]).length;
        break;
      case 9:
        fieldResult[field] = rows.reduce(
          (sum, row) => sum + (parseFloat(row[field]) || 0),
          0
        );
        break;
      default:
        fieldResult[field] = 0;
    }
  }
  return fieldResult;
}

function smartTableOrderRows(rows, order) {
  let orderedRows = JSON.parse(JSON.stringify(rows));
  if (order.length !== 0) {
    orderedRows.sort((a, b) => {
      return order.reduce((previousValue, currentValue) => {
        let value1 = a[currentValue.field];
        let value2 = b[currentValue.field];
        if (currentValue.sort === "desc") {
          [value1, value2] = [value2, value1];
        }
        let result = null;
        if (value1 == value2) {
          result = 0;
        } else if (value1 == null) {
          result = -1;
        } else if (value2 == null) {
          result = 1;
        } else if (typeof value1 === "number" && typeof value2 === "number") {
          result = value1 - value2;
        } else {
          result = `${value1}`.localeCompare(`${value2}`);
        }
        return previousValue ? previousValue || result : result;
      }, null);
    });
  }
  return orderedRows;
}

$.fn.smartTable = function (options) {
  const defaultNumberFormat = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  const $smartTable = this;
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
    activeColumns = Array.from($ths).reduce((activeColumns, th) => (activeColumns[$(th).index()] = $(th).data("stField"), activeColumns), {});
    $ths.addClass("active");
    setValue(activeColumnsKey, activeColumns);
  }
  const $settings = $(`
    <div class="dropdown me-2 smart-table__settings">
      <button class="btn btn-sm" data-bs-auto-close="outside" type="button" data-bs-toggle="dropdown" aria-expanded="false">
        <i class="fa-solid fa-gears"></i>
      </button>
      <ul class="dropdown-menu">
        <li>
          <button class="btn dropdown-item smart-table__reset-button">Сбросить фильтр</button>
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
    <button class="btn btn-sm smart-table__reload-button me-2">
      <i class="fa-solid fa-repeat"></i>
    </button>
  `);
  const $unload = $(`
    <div class="dropdown smart-table__unload">
      <button class="btn btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
        <i class="fa-solid fa-upload"></i>
      </button>
      <ul class="dropdown-menu smart-table__unload-types">
      </ul>
    </div>
  `);

  const $toolsContainer = $(`
    <div class="d-flex mb-1">
    </div>
  `);
  $toolsContainer.append($settings);
  $toolsContainer.append($reloadButton);
  if (options.unloadTypes && options.unloadUrl) {
    const $unloadTypes = $(".smart-table__unload-types", $unload);
    let index = 0;
    for (const unloadType of options.unloadTypes) {
      $unloadTypes.append(`
        <li>
          <button class="dropdown-item btn btn-sm">${unloadType.html}</button>
        </li>
      `);
      $unloadTypes
        .last()
        .first()
        .on("click", async function () {
          const response = await fetch(options.unloadUrl, {
            method: "POST",
            body: JSON.stringify({
              order,
              fieldValuesList,
              type: unloadType.type
            }),
            headers: {
              "X-CSRFToken": options.csrfToken
            }
          });
          const blob = await response.blob();
          console.log(response, blob);
          const objectUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          document.body.appendChild(a);
          a.href = objectUrl;
          const contentDisposition = response.headers.get("Content-Disposition");
          a.download = contentDisposition.split("'")[2];
          a.click();
          a.remove();
          URL.revokeObjectURL(objectUrl);
        });
      index++;
    }
    $toolsContainer.append($unload);
  }
  $smartTable.before($toolsContainer);
  const $columnToggleCheckboxes = $(
    ".smart-table__column-toggle-checkboxes",
    $settings
  );
  $(".smart-table__reset-button", $settings).on("click", async function () {
    fieldValuesList = [];
    resetOrder();
    await showRows();
    $settings.dropdown("hide");
  });

  $("th", $smartTable).each(function () {
    const field = $(this).data("stField");
    const $th = $(this);
    if (field) {
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
    }
  });
  $reloadButton.on("click", async function () {
    $(this).prop("disabled", true);
    await showRows();
    $(this).prop("disabled", false);
  });
  const $menu = $(`
    <div class="dropdown smart-table__menu fw-normal">
      <button class="btn btn-sm" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
        <i class="fa-solid fa-caret-down"></i>
      </button>
      <ul class="dropdown-menu">
        <li class="mb-2">
          <button class="btn dropdown-item smart-table__menu-sort-button">
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
            <button class="btn btn-sm btn-link smart-table__menu-value-check-all">
              Выделить все
              </button>
              <button class="btn btn-sm btn-link smart-table__menu-value-uncheck-all">
              Сбросить
            </button>
            <div class="position-relative mb-2">
              <input type="search" class="form-control smart-table__menu-value-search-input pe-5"/>
              
                
              <i class="position-absolute fa-solid fa-magnifying-glass" style="top: 30%; right: 5%"></i>
             
            </div>
            
            <ul class="list-group list-group-flush smart-table__menu-value-checkboxes border rounded">
              
            </ul>
          </div>
        </li>
        <li><hr class="dropdown-divider"></li>
        <li>
          <div class="text-end mx-2">
            <button class="btn btn-sm btn-outline-primary cancel-button">
              Отмена
            </button>
            <button class="btn btn-sm btn-primary submit-button">
              Принять
            </button>
          </div>
        </li>
      </ul>
    </div>
  `);
  $smartTable.append($menu);

  let $activeTh = null;
  let menuActive = false;
  $(`thead th`, $smartTable).mouseenter(function () {
    if (menuActive || !$(this).data("stField")) {
      return;
    }
    $menu.addClass("active");
    $menu.appendTo(this);
  }).mouseleave(function() {
    if (!menuActive) {
      $menu.removeClass("active");
    }
  });

  const $menuSearchInput = $(".smart-table__menu-value-search-input", $menu);
  function getSearchQueryValueCheckboxes(shouldMatchSearchQuery = true) {
    const searchQuery = $menuSearchInput.val();
    return $(".smart-table__menu-value-checkbox", $menu).filter(function () {
      const isMatched = $(this)
        .val()
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

  $menuSearchInput.on("input", function () {
    $activeTh.data("search-query", $(this).val());
    showSearchQueryResults();
  });
  function getType(th) {
    let type = $(th).data("stType");
    if (!type) {
      type = "string";
      $(th).data("stType", type);
    }
    return type;
  }
  const $menuValueCheckboxes = $(".smart-table__menu-value-checkboxes", $menu);
  let fieldValuesList = [];
  $menu.on("shown.bs.dropdown", async function () {
    menuActive = true;
    $activeTh = $(this).closest("th");
    newOrder = JSON.parse(JSON.stringify(order));
    $menuSearchInput.val($activeTh.data("search-query"));
    $activeTh.data("newSort", $activeTh.data("sort"));
    changeSortIcon();
    changeOrder();
    $menuValueCheckboxes.html(`
      <li class="list-group-item text-center">
        <div class="spinner-border spinner-border-sm text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </li>
    `);
    const field = $activeTh.data("stField");
    const type = getType($activeTh);
    let values = await options.getValues(field, type, fieldValuesList);
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
    for (let value of values) {
      if (value == null) {
        if (
          $menuValueCheckboxes.find(
            `.smart-table__menu-value-checkbox[value=""]`
          ).length !== 0
        ) {
          continue;
        }
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
      } else {
        let formattedValue = formatValue(value, type);
        const id = `checkbox-${value}`;
        $menuValueCheckboxes.append(`
          <li class="list-group-item">
            <div class="form-check">
              <input class="form-check-input smart-table__menu-value-checkbox" type="checkbox" value="${value}" id="${id}" checked>
              <label class="form-check-label" for="${id}">
                ${formattedValue}
              </label>
            </div>
          </li>
        `);
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
            ? fieldValues.include.includes($(this).val())
            : !fieldValues.exclude.includes($(this).val())
        );
      });
    }
    $menuValueCheckboxes.append(`
      <li class="list-group-item smart-table__menu-empty-value d-none text-center">
        Ничего не найдено
      </li>
    `);
    showSearchQueryResults();
  });

  $menu.on("hidden.bs.dropdown", function () {
    menuActive = false;
    $menu.removeClass("active");
    $menuValueCheckboxes.empty();
    $activeTh.data("newSort", null);
    newOrder = null;
    $activeTh = null;
  });

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

  function updateSubtotals() {
    $ths.each(async function () {
      const field = $(this).data("stField");
      const type = getType(this);
      const subtotalTh = $(
        `thead th[data-st-subtotal]:nth-child(${$(this).index() + 1})`,
        $smartTable
      );
      if (subtotalTh.length !== 0) {
        const subtotal = subtotalTh.data("stSubtotal");
        let subtotalResult = null;

        try {
          subtotalResult = await options.getSubtotal(
            field,
            type,
            subtotal,
            fieldValuesList
          );
        } catch (error) {
          console.error(error);
        }
        if (subtotal == 9) {
          subtotalResult = formatValue(subtotalResult, type);
        }
        subtotalTh.html(subtotalResult);
      }
    });
  }

  const $menuButtonSortIcon = $(".smart-table__menu-sort-button-icon", $menu);
  function changeSortIcon() {
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
      fieldSort["type"] = getType(th);
      th.data("sort", fieldSort.sort);
    }
  }
  resetOrder();
  let newOrder = null;
  const $menuButtonSortOrder = $(".smart-table__menu-sort-order", $menu);
  function changeOrder() {
    const field = $activeTh.data("stField");
    const type = getType($activeTh);
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
    $menuButtonSortOrder.html(index != null ? index + 1 : "");
  }
  $(".smart-table__menu-sort-button", $menu).on("click", function () {
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

  $(".cancel-button", $menu).on("click", function () {
    $menu.dropdown("hide");
  });

  async function showRows() {
    try {
      await options.showRows(fieldValuesList, order);
    } catch (error) {
      console.error(error);
    }
    updateSubtotals();
  }

  $(".submit-button", $menu).on("click", async function () {
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
      const include = Array.from(matchedCheckboxes).map((matchedCheckbox) =>
        $(matchedCheckbox).val()
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
      const exclude = Array.from(unmatchedCheckboxes).map((unmatchedCheckbox) =>
        $(unmatchedCheckbox).val()
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
    await showRows();
    $menu.dropdown("hide");
  });

  $(".smart-table__menu-value-check-all").on("click", function () {
    getSearchQueryValueCheckboxes().prop("checked", true);
  });

  $(".smart-table__menu-value-uncheck-all").on("click", function () {
    getSearchQueryValueCheckboxes().prop("checked", false);
  });
  showRows();
};

$.fn.smartTableWithVirtualScroll = function (options) {
  this.smartTable({
    async getValues(field, type, fieldValuesList) {
      const response = await fetch(options.getValuesUrl, {
        method: "POST",
        body: JSON.stringify({
          field,
          type,
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
    async getRows(fieldValuesList, order) {
      if (this.next) {
        const response = await fetch(this.next, {
          method: "POST",
          body: JSON.stringify({
            fieldValuesList,
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
    async insertRows(fieldValuesList, order) {
      const $lastRow = $(options.lastRowTarget);
      const $loadingTr = $lastRow.before(options.loadingHtml).prev();
      const rows = await this.getRows(fieldValuesList, order);
      $loadingTr.remove();
      if (rows) {
        for (const row of rows) {
          $lastRow.before(options.getTr(row));
        }
      }
    },
    async showRows(fieldValuesList, order) {
      if (this.observer) {
        this.observer.unobserve($(options.lastRowTarget)[0]);
      }
      const $rows = $(options.rowsTarget);
      $("tr", $rows).not(options.lastRowTarget).remove();
      const observer = new IntersectionObserver(async (entries, observer) => {
        if (entries[0].isIntersecting) {
          observer.unobserve($(options.lastRowTarget)[0]);
          await this.insertRows(fieldValuesList, order);
          observer.observe($(options.lastRowTarget)[0]);
        }
      });
      this.observer = observer;
      this.reset();
      await this.insertRows(fieldValuesList, order);
      observer.observe($(options.lastRowTarget)[0]);
    },
    async getSubtotal(field, type, subtotal, fieldValuesList) {
      const response = await fetch(this.getSubtotalUrl, {
        method: "POST",
        body: JSON.stringify({
          fieldValuesList,
          field,
          type,
          subtotal,
        }),
        headers: {
          "X-CSRFToken": options.csrfToken,
        },
      });
      const data = await response.json();
      return data.subtotalResult;
    },
    ...options,
  });
};

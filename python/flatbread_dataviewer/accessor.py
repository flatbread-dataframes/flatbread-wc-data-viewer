import json
import uuid
from pathlib import Path

import pandas as pd
from jinja2 import Environment, FileSystemLoader


class ViewAccessor:
    def __init__(self, pandas_obj):
        self._obj = pandas_obj
        template_dir = Path(__file__).parent / "templates"
        self._jinja_env = Environment(loader=FileSystemLoader(template_dir))

    @property
    def data_spec(self):
        """Get the data object that would be used by the viewer"""
        return self._prepare_data()

    @property
    def format_options(self):
        return self._obj.attrs.get("flatbread_viewer_format_options", {})

    @format_options.setter
    def format_options(self, value):
        self._obj.attrs["flatbread_viewer_format_options"] = value

    def get_json(self):
        data = self._prepare_data()
        return json.dumps(data, default=self.json_serializer)

    def _prepare_data(self) -> dict:
        """Convert pandas object to data-viewer format"""
        df = self._obj.to_frame() if isinstance(self._obj, pd.Series) else self._obj

        return {
            "values": [
                [None if pd.isna(cell) else cell for cell in row]
                for row in df.values.tolist()
            ],
            "columns": {
                "values": list(df.columns),
                "names": list(df.columns.names),
                "dtypes": self._get_column_dtypes(df),
            },
            "index": {
                "values": list(df.index),
                "names": list(df.index.names),
                "dtypes": self._get_index_dtypes(df),
            },
        }

    def _get_column_dtypes(self, df):
        dtypes = []
        for col in df.columns:
            dtype = df[col].dtype
            if pd.api.types.is_integer_dtype(dtype):
                dtypes.append('int')
            elif pd.api.types.is_float_dtype(dtype):
                dtypes.append('float')
            elif pd.api.types.is_datetime64_any_dtype(dtype):
                dtypes.append(self._get_date_dtype(df[col]))
            else:
                dtypes.append(None)
        return dtypes

    def _get_index_dtypes(self, df):
        index = df.index
        nlevels = index.nlevels
        dtypes = []
        for level in range(nlevels):
            values = index.get_level_values(level)
            if pd.api.types.is_integer_dtype(values.dtype):
                dtypes.append('int')
            elif pd.api.types.is_float_dtype(values.dtype):
                dtypes.append('float')
            elif pd.api.types.is_datetime64_any_dtype(values.dtype):
                dtypes.append(self._get_date_dtype(values.to_series()))
            else:
                dtypes.append(None)
        return dtypes

    def _resolve_format_option(self, col):
        # exact match (flat string or full tuple)
        if col in self.format_options:
            return self.format_options[col]
        # prefix match for multi-index columns, longest first
        if isinstance(col, tuple):
            for length in range(len(col) - 1, 0, -1):
                prefix = col[:length]
                if prefix in self.format_options:
                    return self.format_options[prefix]
            # bare string as first-level prefix
            if col[0] in self.format_options:
                return self.format_options[col[0]]
        return None

    def _get_date_dtype(self, s: pd.Series):
        """Determine if datetime series should be formatted as date or datetime"""
        # Check if all non-null values have time component of 00:00:00
        s = s.dropna()
        if len(s) == 0:
            return "datetime"

        # Check if all times are midnight
        has_time = (s.dt.hour != 0) | (s.dt.minute != 0) | (s.dt.second != 0)

        return "datetime" if has_time.any() else "date"

    def _repr_html_(self) -> str:
        """Render as HTML for Jupyter display"""
        try:
            data = self._prepare_data()
            viewer_id = f"viewer-{uuid.uuid4()}"

            template = self._jinja_env.get_template("viewer.jinja.html")
            return template.render(
                viewer_id=viewer_id, data=json.dumps(data, default=self.json_serializer)
            )
        except Exception as e:
            return f"<div style='color: red;'>Error rendering data viewer: {e}</div>"

    @staticmethod
    def json_serializer(obj):
        if pd.isna(obj):
            return None
        if hasattr(obj, "isoformat"):
            return obj.isoformat()
        return str(obj)


# Register the accessor
pd.api.extensions.register_dataframe_accessor("viewer")(ViewAccessor)
pd.api.extensions.register_series_accessor("viewer")(ViewAccessor)

# Keep kotlinx.serialization DTOs and companion annotations intact
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.SerializationKt
-keep,includedescriptorclasses class com.kairo.secretary.data.**$$serializer { *; }
-keepclassmembers class com.kairo.secretary.data.** {
    *** Companion;
}
-keepclasseswithmembers class com.kairo.secretary.data.** {
    kotlinx.serialization.KSerializer serializer(...);
}
